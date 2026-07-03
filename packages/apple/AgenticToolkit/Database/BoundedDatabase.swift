import Foundation
import SQLite3
import GRDB

// File-scope so the @convention(c) progress-handler closure can reference them
// without capturing context (which a C function pointer cannot do). Per-op state
// lives in thread-local storage keyed by these.
private let deadlineKey = "com.agentic.boundeddb.deadline"
private let currentDBKey = "com.agentic.boundeddb.currentdb"

/// Errors surfaced by ``BoundedDatabase``.
public enum BoundedDatabaseError: Error, Sendable, Equatable {
    /// A read/write ran past its deadline and was ejected (the progress handler
    /// aborted the statement). Whatever the body threw is replaced by this so
    /// callers can treat an eviction uniformly.
    case deadlineExceeded(lane: String, elapsedMs: Double)
}

/// A point-in-time snapshot of the pool's per-lane counters, for observability.
public struct BoundedDatabaseStats: Sendable, Equatable {
    public struct Lane: Sendable, Equatable {
        public let lane: String        // "write" | "read"
        public let completed: Int
        public let evicted: Int
        public let p50Ms: Double
        public let p99Ms: Double
        public init(lane: String, completed: Int, evicted: Int, p50Ms: Double, p99Ms: Double) {
            self.lane = lane; self.completed = completed; self.evicted = evicted
            self.p50Ms = p50Ms; self.p99Ms = p99Ms
        }
    }
    public let lanes: [Lane]
    public init(lanes: [Lane]) { self.lanes = lanes }
}

/// A GRDB `DatabasePool` with two guarantees layered on top, so a runaway query
/// can never wedge the process:
///
/// 1. **Bulkhead** — GRDB gives one writer + N readers on WAL, so reads never
///    queue behind the single writer.
/// 2. **Ejection** — every `read`/`write` carries a wall-clock deadline; a SQLite
///    progress handler aborts any statement that blows it (`SQLITE_INTERRUPT`),
///    surfaced as ``BoundedDatabaseError/deadlineExceeded(lane:elapsedMs:)``. Plus
///    per-lane latency/eviction metrics.
///
/// Reentrancy: a read issued from inside a `write` runs on the writer connection
/// (read-your-writes); nested `read`/`write` run inline instead of re-entering the
/// pool (which would deadlock GRDB's serial writer). This lets a code base keep a
/// single `read`/`write` chokepoint instead of threading `Database` everywhere.
///
/// `@unchecked Sendable`: GRDB's pool is thread-safe; the metrics are lock-guarded;
/// per-op state lives in thread-local storage on the connection's own thread.
public final class BoundedDatabase: @unchecked Sendable {

    /// The underlying GRDB pool, for callers that want direct GRDB access.
    public let pool: DatabasePool

    private let readDeadline: Duration
    private let writeDeadline: Duration

    private let metricsLock = NSLock()
    private var writeMetrics = LaneMetrics()
    private var readMetrics = LaneMetrics()

    // MARK: - Init

    /// - Parameters:
    ///   - path: the database file path.
    ///   - readers: read-pool size (GRDB `maximumReaderCount`).
    ///   - readDeadline / writeDeadline: default ceilings; a runaway op is ejected.
    ///   - busyTimeout: how long to wait on a locked write before failing.
    ///   - prepare: runs on every connection at open, after WAL/temp_store setup —
    ///     e.g. install app pragmas or collations. The progress-handler ejection is
    ///     installed for you.
    public init(
        path: String,
        readers: Int = 3,
        readDeadline: Duration = .seconds(10),
        writeDeadline: Duration = .seconds(60),
        busyTimeout: TimeInterval = 5,
        prepare: (@Sendable (Database) throws -> Void)? = nil
    ) throws {
        self.readDeadline = readDeadline
        self.writeDeadline = writeDeadline

        var config = Configuration()
        config.maximumReaderCount = readers
        config.busyMode = .timeout(busyTimeout)
        config.prepareDatabase { database in
            // Keep transient tables in memory (recursive CTEs, ORDER BY spills) — no
            // temp file for a read-only connection to fail on.
            try database.execute(sql: "PRAGMA temp_store=MEMORY")
            try prepare?(database)
            BoundedDatabase.installEjectionHandler(database.sqliteConnection)
        }
        self.pool = try DatabasePool(path: path, configuration: config)
    }

    // MARK: - Access

    /// Runs `body` on the writer connection, ejected if it exceeds `deadline`
    /// (default `writeDeadline`). Reentrant: a nested write/read runs inline.
    @discardableResult
    public func write<T>(deadline: Duration? = nil, _ body: (Database) throws -> T) throws -> T {
        if let database = Self.currentDB { return try body(database) }
        return try run(lane: "write", deadline: deadline ?? writeDeadline, write: true, body)
    }

    /// Runs `body` on a reader connection (or, inside a write, the writer
    /// connection — read-your-writes), ejected if it exceeds `deadline`.
    @discardableResult
    public func read<T>(deadline: Duration? = nil, _ body: (Database) throws -> T) throws -> T {
        if let database = Self.currentDB { return try body(database) }
        return try run(lane: "read", deadline: deadline ?? readDeadline, write: false, body)
    }

    private func run<T>(
        lane: String, deadline: Duration, write: Bool, _ body: (Database) throws -> T
    ) throws -> T {
        let start = Date()
        func op(_ database: Database) throws -> T {
            Self.currentDB = database
            Self.armDeadline(deadline)
            defer { Self.disarmDeadline(); Self.currentDB = nil }
            do {
                return try body(database)
            } catch let error as DatabaseError where error.resultCode == .SQLITE_INTERRUPT {
                throw BoundedDatabaseError.deadlineExceeded(
                    lane: lane, elapsedMs: Date().timeIntervalSince(start) * 1000
                )
            }
        }
        do {
            let value = write ? try pool.write(op) : try pool.read(op)
            record(write: write, evicted: false, seconds: Date().timeIntervalSince(start))
            return value
        } catch let error as BoundedDatabaseError {
            record(write: write, evicted: true, seconds: Date().timeIntervalSince(start))
            throw error
        }
    }

    // MARK: - Stats

    public var stats: BoundedDatabaseStats {
        metricsLock.withLock {
            BoundedDatabaseStats(lanes: [writeMetrics.snapshot("write"), readMetrics.snapshot("read")])
        }
    }

    // MARK: - Private: ejection

    /// Installed on every connection. Fires every ~1000 VM instructions on the
    /// statement's own thread; returns non-zero (abort) once the thread-local
    /// deadline set by `run` has passed. No captures ⇒ bridges to `@convention(c)`.
    private static func installEjectionHandler(_ connection: OpaquePointer?) {
        sqlite3_progress_handler(connection, 1000, { _ in
            guard let deadline = Thread.current.threadDictionary[deadlineKey] as? Date else { return 0 }
            return Date() >= deadline ? 1 : 0
        }, nil)
    }

    private static func armDeadline(_ deadline: Duration) {
        Thread.current.threadDictionary[deadlineKey] = Date().addingTimeInterval(deadline.seconds)
    }
    private static func disarmDeadline() {
        Thread.current.threadDictionary.removeObject(forKey: deadlineKey)
    }

    private static var currentDB: Database? {
        get { Thread.current.threadDictionary[currentDBKey] as? Database }
        set {
            if let newValue {
                Thread.current.threadDictionary[currentDBKey] = newValue
            } else {
                Thread.current.threadDictionary.removeObject(forKey: currentDBKey)
            }
        }
    }

    // MARK: - Private: metrics

    private func record(write: Bool, evicted: Bool, seconds: Double) {
        metricsLock.withLock {
            if write {
                writeMetrics.record(evicted: evicted, seconds: seconds)
            } else {
                readMetrics.record(evicted: evicted, seconds: seconds)
            }
        }
    }
}

/// Per-lane counters + a bounded window of recent durations for percentiles.
private struct LaneMetrics {
    private(set) var completed = 0
    private(set) var evicted = 0
    private var recent: [Double] = []
    private static let window = 128

    mutating func record(evicted: Bool, seconds: Double) {
        if evicted {
            self.evicted += 1
        } else {
            completed += 1
            recent.append(seconds)
            if recent.count > Self.window { recent.removeFirst(recent.count - Self.window) }
        }
    }

    func snapshot(_ lane: String) -> BoundedDatabaseStats.Lane {
        let sorted = recent.sorted()
        return BoundedDatabaseStats.Lane(
            lane: lane, completed: completed, evicted: evicted,
            p50Ms: Self.percentile(sorted, 0.50) * 1000,
            p99Ms: Self.percentile(sorted, 0.99) * 1000
        )
    }

    private static func percentile(_ sorted: [Double], _ quantile: Double) -> Double {
        guard !sorted.isEmpty else { return 0 }
        let rank = Int((Double(sorted.count - 1) * quantile).rounded())
        return sorted[min(max(rank, 0), sorted.count - 1)]
    }
}

private extension Duration {
    var seconds: Double {
        let (secs, atto) = components
        return Double(secs) + Double(atto) / 1e18
    }
}

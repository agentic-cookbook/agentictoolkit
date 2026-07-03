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
        public let inFlight: Int
        public let completed: Int
        public let evicted: Int
        public let p50Ms: Double
        public let p99Ms: Double
        public init(lane: String, inFlight: Int, completed: Int, evicted: Int, p50Ms: Double, p99Ms: Double) {
            self.lane = lane; self.inFlight = inFlight; self.completed = completed
            self.evicted = evicted; self.p50Ms = p50Ms; self.p99Ms = p99Ms
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

    /// The underlying GRDB writer — a `DatabasePool` for file databases, a serial
    /// `DatabaseQueue` for in-memory ones — for callers that want direct GRDB access.
    public let writer: any DatabaseWriter

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
        // DatabasePool needs a real file (WAL). In-memory databases are private
        // per connection, so use a serial DatabaseQueue there — reads and writes
        // share the single connection (read-your-writes is trivial); ejection and
        // metrics still apply.
        if path == ":memory:" {
            self.writer = try DatabaseQueue(configuration: config)
        } else {
            self.writer = try DatabasePool(path: path, configuration: config)
        }
    }

    // MARK: - Access

    private enum Access {
        case read, write, writeNoTransaction
        var lane: String { self == .read ? "read" : "write" }
        var isWrite: Bool { self != .read }
    }

    /// Runs `body` on the writer connection inside a transaction, ejected if it
    /// exceeds `deadline`. Reentrant: a nested write/read runs inline on the current
    /// connection and is bounded by the ENCLOSING op's deadline — a nested call's own
    /// `deadline:` argument is ignored (there is one armed deadline per thread).
    @discardableResult
    public func write<T>(deadline: Duration? = nil, _ body: (Database) throws -> T) throws -> T {
        if let database = Self.currentDB { return try Self.translatingInterrupt(lane: "write") { try body(database) } }
        return try run(access: .write, deadline: deadline ?? writeDeadline, body)
    }

    /// Runs `body` on a reader connection (or, inside a write, the writer
    /// connection — read-your-writes), ejected if it exceeds `deadline`. Reentrant:
    /// a nested call inherits the enclosing op's deadline (its own `deadline:` is
    /// ignored — see ``write(deadline:_:)``).
    @discardableResult
    public func read<T>(deadline: Duration? = nil, _ body: (Database) throws -> T) throws -> T {
        if let database = Self.currentDB { return try Self.translatingInterrupt(lane: "read") { try body(database) } }
        return try run(access: .read, deadline: deadline ?? readDeadline, body)
    }

    /// Like `write`, but does NOT open a transaction — for blocks that manage their
    /// own (explicit `BEGIN`/`COMMIT`) or run statements that can't be inside one
    /// (`ATTACH`, `VACUUM`). Deadline-bounded; reentrant calls inherit the enclosing
    /// op's deadline (see ``write(deadline:_:)``).
    @discardableResult
    public func writeWithoutTransaction<T>(deadline: Duration? = nil, _ body: (Database) throws -> T) throws -> T {
        if let database = Self.currentDB { return try Self.translatingInterrupt(lane: "write") { try body(database) } }
        return try run(access: .writeNoTransaction, deadline: deadline ?? writeDeadline, body)
    }

    /// True when the calling thread is already inside a `read`/`write`/
    /// `writeWithoutTransaction` on this database (so a nested call runs inline). Lets
    /// a consumer map/wrap errors only at the OUTERMOST boundary: a reentrant inner
    /// call should rethrow the `BoundedDatabaseError` untouched so the enclosing
    /// `run` still records the eviction, and only the top-level caller translates it.
    public var isReentrant: Bool { Self.currentDB != nil }

    /// Maps a raw `SQLITE_INTERRUPT` (what the progress handler raises when the
    /// deadline passes) to a typed ``BoundedDatabaseError/deadlineExceeded``, so an
    /// ejection surfaces the same way whether it happens on the outer `run` path or
    /// inline on a reentrant nested call.
    private static func translatingInterrupt<T>(lane: String, _ body: () throws -> T) throws -> T {
        do {
            return try body()
        } catch let error as DatabaseError where error.resultCode == .SQLITE_INTERRUPT {
            throw BoundedDatabaseError.deadlineExceeded(lane: lane, elapsedMs: 0)
        }
    }

    private func run<T>(
        access: Access, deadline: Duration, _ body: (Database) throws -> T
    ) throws -> T {
        let start = DispatchTime.now()
        func elapsedSeconds() -> Double {
            Double(DispatchTime.now().uptimeNanoseconds &- start.uptimeNanoseconds) / 1e9
        }
        func op(_ database: Database) throws -> T {
            Self.currentDB = database
            Self.armDeadline(deadline)
            defer {
                // Disarm BEFORE any cleanup so the cleanup itself can't be ejected.
                Self.disarmDeadline()
                // Safety net: a writeWithoutTransaction body manages its own
                // transaction; if it was ejected (or otherwise returned) with one
                // still open, roll it back here (deadline already disarmed) so the
                // pooled writer connection is never handed back mid-transaction.
                if access == .writeNoTransaction, database.isInsideTransaction {
                    try? database.execute(sql: "ROLLBACK")
                }
                Self.currentDB = nil
            }
            do {
                return try body(database)
            } catch let error as DatabaseError where error.resultCode == .SQLITE_INTERRUPT {
                throw BoundedDatabaseError.deadlineExceeded(
                    lane: access.lane, elapsedMs: elapsedSeconds() * 1000
                )
            }
        }
        enter(write: access.isWrite)
        defer { leave(write: access.isWrite) }
        do {
            let value: T
            switch access {
            case .read: value = try writer.read(op)
            case .write: value = try writer.write(op)
            case .writeNoTransaction: value = try writer.writeWithoutTransaction(op)
            }
            record(write: access.isWrite, evicted: false, seconds: elapsedSeconds())
            return value
        } catch let error as BoundedDatabaseError {
            record(write: access.isWrite, evicted: true, seconds: elapsedSeconds())
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
    ///
    /// The deadline is a MONOTONIC clock reading (`DispatchTime` uptime nanos), not
    /// wall-clock: an NTP step or sleep/wake that moves the wall clock backward must
    /// not stop ejection (that would re-enable the wedge this exists to prevent).
    private static func installEjectionHandler(_ connection: OpaquePointer?) {
        sqlite3_progress_handler(connection, 1000, { _ in
            guard let deadline = Thread.current.threadDictionary[deadlineKey] as? NSNumber else { return 0 }
            return DispatchTime.now().uptimeNanoseconds >= deadline.uint64Value ? 1 : 0
        }, nil)
    }

    private static func armDeadline(_ deadline: Duration) {
        // max(0,…): UInt64(negativeDouble) is a fatal trap; a non-positive deadline
        // should eject immediately, not crash the connection thread.
        let horizon = DispatchTime.now().uptimeNanoseconds &+ UInt64(max(0, deadline.seconds) * 1e9)
        Thread.current.threadDictionary[deadlineKey] = NSNumber(value: horizon)
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

    /// Bracket an op with in-flight accounting so `stats` can report how many ops
    /// each lane is currently running (a lane stuck with in-flight > 0 and no
    /// completions is a wedge). Only the non-reentrant `run` path calls these — a
    /// nested reentrant op is already counted by its enclosing op.
    private func enter(write: Bool) {
        metricsLock.withLock { if write { writeMetrics.inFlight += 1 } else { readMetrics.inFlight += 1 } }
    }
    private func leave(write: Bool) {
        metricsLock.withLock { if write { writeMetrics.inFlight -= 1 } else { readMetrics.inFlight -= 1 } }
    }
}

/// Per-lane counters + a bounded window of recent durations for percentiles.
private struct LaneMetrics {
    var inFlight = 0
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
            lane: lane, inFlight: inFlight, completed: completed, evicted: evicted,
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

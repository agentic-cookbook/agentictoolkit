import Foundation
import SQLite3
import AgenticToolkitExecution

/// How a ``SQLiteResource`` opens its connection.
public enum SQLiteOpenMode: Sendable {
    /// Read/write, creating the file if missing. Sets `journal_mode=WAL`.
    case readWrite
    /// Read-only. Several of these form the read lane that, thanks to WAL, never
    /// blocks behind the single writer.
    case readOnly
}

/// A single SQLite connection that conforms ``BoundedExecutionResource`` so the
/// generic ``BoundedExecutionQueue`` can time and eject work run against it.
///
/// - `installAbortHook` → `sqlite3_progress_handler`: the callback fires every
///   `progressStep` VM instructions and returns non-zero to abort the running
///   statement (`SQLITE_INTERRUPT`). This is the self-eject channel that works
///   even while the CPU is saturated.
/// - `interrupt` → `sqlite3_interrupt`: thread-safe abort from the watchdog for a
///   statement stuck in a single long syscall.
///
/// `@unchecked Sendable`: `interrupt()` is called from the watchdog thread, which
/// SQLite explicitly permits; all other access is serialised by the one worker
/// lane that drives this resource. The connection is opened FULLMUTEX so the
/// concurrent `sqlite3_interrupt` is always safe.
public final class SQLiteResource: BoundedExecutionResource, @unchecked Sendable {

    /// The raw connection handle, for callers that prepare/step statements. Only
    /// touch it from inside a `BoundedExecutionQueue.runSync` body for this
    /// resource — that is the lane that serialises access.
    public let handle: OpaquePointer

    /// VM instructions between progress-handler callbacks. Small enough that a
    /// sub-millisecond deadline is honoured promptly, large enough not to tax
    /// tight inner loops.
    private static let progressStep: Int32 = 1_000

    private let lock = NSLock()
    private var abortHook: (@Sendable () -> Bool)?
    private var closed = false

    public init(path: String, mode: SQLiteOpenMode) throws {
        var database: OpaquePointer?
        let flags: Int32
        switch mode {
        case .readWrite: flags = SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX
        case .readOnly:  flags = SQLITE_OPEN_READONLY | SQLITE_OPEN_FULLMUTEX
        }
        guard sqlite3_open_v2(path, &database, flags, nil) == SQLITE_OK, let opened = database else {
            let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "open failed"
            if let database { sqlite3_close(database) }
            throw SQLiteResourceError.openFailed(message)
        }
        self.handle = opened

        // WAL enables the reader/writer bulkhead; only the writer can set it.
        if mode == .readWrite {
            exec("PRAGMA journal_mode=WAL")
            exec("PRAGMA foreign_keys=ON")
        }
        // Wait rather than fail when another connection holds the write lock.
        exec("PRAGMA busy_timeout=5000")
        // Keep transient tables (e.g. a recursive CTE's queue, an ORDER BY spill)
        // in memory: no temp file to open — which read-only connections can't
        // create — and no temp-file lock to stall on.
        exec("PRAGMA temp_store=MEMORY")
    }

    deinit {
        close()
    }

    /// Idempotent: detaches the progress handler and closes the connection once.
    /// Guarded by `lock` so a concurrent `interrupt()` (watchdog) can never touch a
    /// closed handle.
    public func close() {
        lock.withLock {
            guard !closed else { return }
            closed = true
            sqlite3_progress_handler(handle, 0, nil, nil)
            sqlite3_close(handle)
        }
    }

    public func installAbortHook(_ shouldAbort: @escaping @Sendable () -> Bool) {
        lock.withLock { abortHook = shouldAbort }
        let context = Unmanaged.passUnretained(self).toOpaque()
        // The C callback captures nothing (so it bridges to @convention(c)); it
        // recovers `self` from the context pointer and consults the stored hook.
        sqlite3_progress_handler(handle, Self.progressStep, { raw in
            guard let raw else { return 0 }
            let resource = Unmanaged<SQLiteResource>.fromOpaque(raw).takeUnretainedValue()
            return resource.shouldAbortNow() ? 1 : 0
        }, context)
    }

    public func interrupt() {
        // Guarded so the watchdog never interrupts a handle `close()` has freed.
        lock.withLock {
            if !closed { sqlite3_interrupt(handle) }
        }
    }

    private func shouldAbortNow() -> Bool {
        (lock.withLock { abortHook })?() ?? false
    }

    /// Fire-and-forget statement, ignoring rows. Used for pragmas/DDL in `init`.
    @discardableResult
    private func exec(_ sql: String) -> Bool {
        sqlite3_exec(handle, sql, nil, nil, nil) == SQLITE_OK
    }
}

public enum SQLiteResourceError: Error, Sendable, Equatable {
    case openFailed(String)
}

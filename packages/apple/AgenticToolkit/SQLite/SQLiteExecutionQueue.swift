import Foundation
import AgenticToolkitExecution

/// The two standard SQLite lanes: a single-connection write pool and a
/// multi-connection read pool. WAL lets the read connections run concurrently
/// with the writer and each other, so hot-path reads never queue behind a heavy
/// write — the bulkhead.
public enum SQLitePool {
    public static let write = PoolID("write")
    public static let read = PoolID("read")
}

public extension BoundedExecutionQueue where Resource == SQLiteResource {

    /// Builds a bounded execution queue over one SQLite database file: one
    /// read/write connection (`SQLitePool.write`) plus `readers` read-only
    /// connections (`SQLitePool.read`). The writer opens the file in WAL mode; the
    /// readers ride that WAL.
    ///
    /// - Parameters:
    ///   - path: the database file path.
    ///   - readers: size of the read lane (≥1). Defaults to 3.
    ///   - watchdog: how often the watchdog scans for over-budget units.
    static func sqlite(
        path: String,
        readers: Int = 3,
        watchdog: Duration = .milliseconds(50)
    ) throws -> BoundedExecutionQueue<SQLiteResource> {
        precondition(readers >= 1, "need at least one reader")
        // Open the writer first so it establishes WAL before readers attach.
        let writer = try SQLiteResource(path: path, mode: .readWrite)
        let readConnections = try (0..<readers).map { _ in
            try SQLiteResource(path: path, mode: .readOnly)
        }
        return BoundedExecutionQueue(
            pools: [SQLitePool.write: [writer], SQLitePool.read: readConnections],
            watchdogInterval: watchdog
        )
    }
}

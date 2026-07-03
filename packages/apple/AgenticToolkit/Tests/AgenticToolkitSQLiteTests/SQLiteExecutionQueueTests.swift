import XCTest
import SQLite3
import AgenticToolkitExecution
@testable import AgenticToolkitSQLite

private enum SQLiteTestError: Error, Equatable {
    case exec(String)
    case step(Int32)
}

final class SQLiteExecutionQueueTests: XCTestCase {

    private var path: String!

    override func setUpWithError() throws {
        let name = "sqlite-exec-\(UUID().uuidString).db"
        path = NSTemporaryDirectory() + name
    }

    override func tearDownWithError() throws {
        for suffix in ["", "-wal", "-shm"] {
            try? FileManager.default.removeItem(atPath: path + suffix)
        }
    }

    // MARK: - C helpers (run inside a runSync body, on that resource's lane)

    private func execAll(_ database: OpaquePointer, _ sql: String) throws {
        var errmsg: UnsafeMutablePointer<CChar>?
        guard sqlite3_exec(database, sql, nil, nil, &errmsg) == SQLITE_OK else {
            let message = errmsg.map { String(cString: $0) } ?? "exec failed"
            sqlite3_free(errmsg)
            throw SQLiteTestError.exec(message)
        }
    }

    private func scalarInt(_ database: OpaquePointer, _ sql: String) throws -> Int {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw SQLiteTestError.exec(String(cString: sqlite3_errmsg(database)))
        }
        defer { sqlite3_finalize(stmt) }
        let code = sqlite3_step(stmt)
        guard code == SQLITE_ROW else { throw SQLiteTestError.step(code) }
        return Int(sqlite3_column_int64(stmt, 0))
    }

    // MARK: - Tests

    func testWriteThenReadAcrossPools() throws {
        let queue = try BoundedExecutionQueue.sqlite(path: path, readers: 2)
        defer { queue.shutdown() }

        try queue.runSync(pool: SQLitePool.write, deadline: .seconds(2)) { resource in
            try self.execAll(resource.handle, "CREATE TABLE t(x INTEGER); INSERT INTO t VALUES (42);")
        }
        // A separate read-only connection sees the committed write through WAL.
        let value = try queue.runSync(pool: SQLitePool.read, deadline: .seconds(2)) { resource in
            try self.scalarInt(resource.handle, "SELECT x FROM t")
        }
        XCTAssertEqual(value, 42)
    }

    func testRunawayQueryIsEjectedWithinBudget() throws {
        let queue = try BoundedExecutionQueue.sqlite(path: path, readers: 1)
        defer { queue.shutdown() }

        // Seed a small table on the writer.
        try queue.runSync(pool: SQLitePool.write, deadline: .seconds(5)) { resource in
            try self.execAll(resource.handle, """
                CREATE TABLE big(x INTEGER);
                INSERT INTO big(x)
                  WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 1500)
                  SELECT n FROM seq;
                """)
        }

        // A pathological triple self-join on the READ lane: ~3.4e9 nested-loop
        // iterations to count — a pure scan (no temp), exactly the kind of
        // unbounded query that used to wedge the daemon. The progress handler (and
        // the watchdog's sqlite3_interrupt as backstop) must abort it near the
        // 200 ms deadline rather than run for minutes.
        let runaway = "SELECT count(*) FROM big AS a, big AS b, big AS c"
        let start = Date()
        XCTAssertThrowsError(
            try queue.runSync(pool: SQLitePool.read, deadline: .milliseconds(200)) { resource in
                _ = try self.scalarInt(resource.handle, runaway)
            }
        ) { error in
            guard case ExecutionError.deadlineExceeded(let pool, _) = error else {
                return XCTFail("expected deadlineExceeded, got \(error)")
            }
            XCTAssertEqual(pool, "read")
        }
        XCTAssertLessThan(Date().timeIntervalSince(start), 3.0, "ejected promptly, did not hang")
    }

    func testReadOnlyConnectionRejectsWrites() throws {
        let queue = try BoundedExecutionQueue.sqlite(path: path, readers: 1)
        defer { queue.shutdown() }

        try queue.runSync(pool: SQLitePool.write, deadline: .seconds(2)) { resource in
            try self.execAll(resource.handle, "CREATE TABLE t(x INTEGER);")
        }
        // Writing through the read lane must fail (proves the pool is truly RO),
        // and it's a plain SQLite error — not a deadline eviction.
        XCTAssertThrowsError(
            try queue.runSync(pool: SQLitePool.read, deadline: .seconds(2)) { resource in
                try self.execAll(resource.handle, "INSERT INTO t VALUES (1);")
            }
        ) { error in
            if case ExecutionError.deadlineExceeded = error {
                XCTFail("a read-only write should fail immediately, not time out")
            }
        }
    }
}

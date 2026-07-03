import XCTest
import GRDB
@testable import AgenticToolkitDatabase

final class BoundedDatabaseTests: XCTestCase {

    private var path: String!

    override func setUpWithError() throws {
        path = NSTemporaryDirectory() + "bdb-\(UUID().uuidString).db"
    }

    override func tearDownWithError() throws {
        for suffix in ["", "-wal", "-shm"] {
            try? FileManager.default.removeItem(atPath: path + suffix)
        }
    }

    func testWriteThenReadAcrossLanes() throws {
        let store = try BoundedDatabase(path: path, readers: 2)
        try store.write { conn in try conn.execute(sql: "CREATE TABLE t(x INTEGER); INSERT INTO t VALUES (42)") }
        // A reader connection sees the committed write through WAL.
        let value = try store.read { conn in try Int.fetchOne(conn, sql: "SELECT x FROM t") }
        XCTAssertEqual(value, 42)
    }

    func testReadYourWritesInsideWrite() throws {
        let store = try BoundedDatabase(path: path)
        try store.write { conn in
            try conn.execute(sql: "CREATE TABLE t(x INTEGER)")
            try conn.execute(sql: "INSERT INTO t VALUES (7)")
            // A read issued inside the write is reentrant → runs on the writer
            // connection and sees its own uncommitted row.
            let inner = try store.read { reader in try Int.fetchOne(reader, sql: "SELECT x FROM t") }
            XCTAssertEqual(inner, 7)
        }
    }

    func testRunawayQueryIsEjectedWithinBudget() throws {
        let store = try BoundedDatabase(path: path, readers: 1)
        try store.write { conn in
            try conn.execute(sql: """
                CREATE TABLE big(x INTEGER);
                INSERT INTO big(x)
                  WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 1500)
                  SELECT n FROM seq;
                """)
        }
        // ~3.4e9 nested-loop rows — must be ejected near the 200 ms deadline.
        let start = Date()
        XCTAssertThrowsError(
            try store.read(deadline: .milliseconds(200)) { conn in
                try Int.fetchOne(conn, sql: "SELECT count(*) FROM big AS a, big AS b, big AS c")
            }
        ) { error in
            guard case BoundedDatabaseError.deadlineExceeded(let lane, _) = error else {
                return XCTFail("expected deadlineExceeded, got \(error)")
            }
            XCTAssertEqual(lane, "read")
        }
        XCTAssertLessThan(Date().timeIntervalSince(start), 3, "ejected promptly, did not hang")
    }

    func testInMemoryUsesSerialQueue() throws {
        // `:memory:` → DatabaseQueue; reads and writes share the one connection.
        let store = try BoundedDatabase(path: ":memory:")
        try store.write { conn in try conn.execute(sql: "CREATE TABLE t(x INTEGER); INSERT INTO t VALUES (5)") }
        let value = try store.read { conn in try Int.fetchOne(conn, sql: "SELECT x FROM t") }
        XCTAssertEqual(value, 5)
    }

    func testStatsCountLanes() throws {
        let store = try BoundedDatabase(path: path)
        try store.write { conn in try conn.execute(sql: "CREATE TABLE t(x INTEGER)") }
        _ = try store.read { conn in try Int.fetchOne(conn, sql: "SELECT count(*) FROM t") }

        let lanes = Dictionary(uniqueKeysWithValues: store.stats.lanes.map { ($0.lane, $0) })
        XCTAssertGreaterThan(lanes["write"]?.completed ?? 0, 0)
        XCTAssertGreaterThan(lanes["read"]?.completed ?? 0, 0)
        XCTAssertEqual(lanes["read"]?.evicted, 0)
        // No op is running once the calls above returned.
        XCTAssertEqual(lanes["write"]?.inFlight, 0)
        XCTAssertEqual(lanes["read"]?.inFlight, 0)
    }

    /// A `writeWithoutTransaction` body that opens its own transaction, is ejected
    /// mid-statement, and SWALLOWS the error (as a self-managed importer's catch
    /// does) must not hand a connection with an open transaction back to the pool —
    /// otherwise the next write fails with "cannot start a transaction within a
    /// transaction" and the writer wedges. The safety net in `run` must roll it back.
    func testSwallowedEjectionInWriteWithoutTransactionDoesNotPoisonPool() throws {
        let store = try BoundedDatabase(path: path, readers: 1)
        try store.write { conn in
            try conn.execute(sql: """
                CREATE TABLE big(x INTEGER);
                INSERT INTO big(x)
                  WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 1500)
                  SELECT n FROM seq;
                """)
        }
        XCTAssertNoThrow(
            try store.writeWithoutTransaction(deadline: .milliseconds(200)) { conn in
                try conn.execute(sql: "BEGIN")
                do {
                    // A pending write, then a runaway SELECT. Interrupting a WRITE
                    // statement makes SQLite auto-rollback the whole txn (autocommit
                    // returns to 1); interrupting a SELECT while a write is pending
                    // leaves the txn OPEN (autocommit stays 0) — the real
                    // connection-poisoning case the safety net exists to clean up.
                    try conn.execute(sql: "CREATE TABLE sink(n INTEGER)")
                    _ = try Int.fetchOne(conn, sql: "SELECT count(*) FROM big AS a, big AS b, big AS c")
                    try conn.execute(sql: "COMMIT")
                } catch {
                    // Swallow, exactly like a self-managed importer reporting the error.
                }
            }
        )
        // Without the safety net the connection returns to the pool mid-transaction,
        // so this fresh write throws "cannot start a transaction within a transaction".
        XCTAssertNoThrow(
            try store.write { conn in try conn.execute(sql: "CREATE TABLE after(x INTEGER)") }
        )
    }
}

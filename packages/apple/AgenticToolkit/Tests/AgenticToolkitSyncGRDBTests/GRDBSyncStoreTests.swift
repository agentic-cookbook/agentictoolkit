import XCTest
import GRDB
import AgenticToolkitDatabase
import AgenticToolkitSync
@testable import AgenticToolkitSyncGRDB

final class GRDBSyncStoreTests: XCTestCase {

    private var path: String!

    override func setUpWithError() throws {
        path = NSTemporaryDirectory() + "sync-\(UUID().uuidString).db"
    }

    override func tearDownWithError() throws {
        for suffix in ["", "-wal", "-shm"] {
            try? FileManager.default.removeItem(atPath: path + suffix)
        }
    }

    private func makeStore() throws -> GRDBSyncStore {
        GRDBSyncStore(database: try BoundedDatabase(path: path))
    }

    private let notes = SyncResource(resource: "personal.notes", schemaVersion: 1)

    func testPrepareIsIdempotentAndCreatesMirrorTables() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.prepare(resources: [notes]) // second call must not throw
        XCTAssertEqual(try store.liveRows(resource: "personal.notes", limit: 10, offset: 0).count, 0)
    }

    func testApplyIsAtomicWithCursor() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        let batch = [
            SyncChange(
                resource: "personal.notes", id: "a", op: .upsert, syncVersion: "1", data: ["title": .string("A")]
            ),
            SyncChange(resource: "unknown.table", id: "x", op: .upsert, syncVersion: "2", data: [:])
        ]
        await XCTAssertThrowsErrorAsync(try await store.apply(batch, advancingTo: SyncCursor(rawValue: "c2")))
        // Nothing landed: not the good row, not the cursor.
        XCTAssertEqual(try store.liveRows(resource: "personal.notes", limit: 10, offset: 0).count, 0)
        let cursor = try await store.cursor()
        XCTAssertNil(cursor)
    }

    func testStageWritesRowAndOutboxAtomically() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("offline")])
        )
        let rows = try store.liveRows(resource: "personal.notes", limit: 10, offset: 0)
        XCTAssertEqual(rows.count, 1)
        XCTAssertEqual(rows[0]["title"]?.stringValue, "offline")
        let ops = try await store.pendingOps(limit: 10)
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].rowId, "r1")
        let status = try store.status()
        XCTAssertEqual(status.outboxDepth, 1)
    }

    func testCompleteAppliedRemovesOpRejectedQuarantines() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: [:]))
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r2", type: .upsert, data: [:]))
        let ops = try await store.pendingOps(limit: 10)
        try await store.complete([
            SyncPushResult(opId: ops[0].opId, status: .applied),
            SyncPushResult(opId: ops[1].opId, status: .rejected, reason: "invalid_data")
        ])
        let remaining = try await store.pendingOps(limit: 10)
        XCTAssertEqual(remaining.count, 0)
        let status = try store.status()
        XCTAssertEqual(status.quarantinedDepth, 1)
    }

    func testDeleteTombstonesLocallyAndResyncPreservesOutbox() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.apply(
            [SyncChange(resource: "personal.notes", id: "s1", op: .upsert, syncVersion: "3", data: [:])],
            advancingTo: SyncCursor(rawValue: "c3")
        )
        try await store.apply(
            [SyncChange(resource: "personal.notes", id: "s1", op: .delete, syncVersion: "4")],
            advancingTo: SyncCursor(rawValue: "c4")
        )
        XCTAssertEqual(try store.liveRows(resource: "personal.notes", limit: 10, offset: 0).count, 0)
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "mine", type: .upsert, data: [:]))
        try await store.resetForResync()
        let cursor = try await store.cursor()
        XCTAssertNil(cursor)
        let pending = try await store.pendingOps(limit: 10)
        XCTAssertEqual(pending.count, 1)
    }
}

/// Async throwing assertion helper (XCTest lacks one).
func XCTAssertThrowsErrorAsync(_ expression: @autoclosure () async throws -> Void,
                               file: StaticString = #filePath, line: UInt = #line) async {
    do {
        try await expression()
        XCTFail("expected error", file: file, line: line)
    } catch {}
}

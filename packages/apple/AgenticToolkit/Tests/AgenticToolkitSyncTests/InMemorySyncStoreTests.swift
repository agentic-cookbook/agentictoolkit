import XCTest
@testable import AgenticToolkitSync

final class InMemorySyncStoreTests: XCTestCase {

    func testStageThenPendingThenComplete() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(LocalMutation(
            resource: "personal.notes",
            rowId: SyncID.uuidV7(),
            type: .upsert,
            data: ["title": .string("offline")]
        ))
        let ops = try await store.pendingOps(limit: 10)
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].type, .upsert)
        try await store.complete([SyncPushResult(opId: ops[0].opId, status: .applied)])
        let after = try await store.pendingOps(limit: 10)
        XCTAssertTrue(after.isEmpty)
    }

    func testApplyAdvancesCursorAndResyncPreservesOutbox() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .delete))
        try await store.apply(
            [SyncChange(resource: "personal.notes", id: "s1", op: .upsert, syncVersion: "5", data: [:])],
            advancingTo: SyncCursor(rawValue: "c5")
        )
        let cursor = try await store.cursor()
        XCTAssertEqual(cursor, SyncCursor(rawValue: "c5"))
        let rowCountAfterApply = try await store.rowCount(resource: "personal.notes")
        XCTAssertEqual(rowCountAfterApply, 1)
        try await store.resetForResync()
        let cursorAfterResync = try await store.cursor()
        XCTAssertNil(cursorAfterResync)
        let rowCountAfterResync = try await store.rowCount(resource: "personal.notes")
        XCTAssertEqual(rowCountAfterResync, 0)
        let pendingAfterResync = try await store.pendingOps(limit: 10)
        XCTAssertEqual(pendingAfterResync.count, 1) // outbox survives
    }
}

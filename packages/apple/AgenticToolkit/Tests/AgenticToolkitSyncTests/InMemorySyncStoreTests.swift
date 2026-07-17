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

    func testStageCoalescesUpsertThenUpsertKeepingOpIdAndBaseVersion() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.apply(
            [SyncChange(resource: "personal.notes", id: "r1", op: .upsert, syncVersion: "3", data: [:])],
            advancingTo: SyncCursor(rawValue: "c3")
        )
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        let originalOpId = await store.pendingOpId(resource: "personal.notes", rowId: "r1")
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["body": .string("second")])
        )
        let ops = try await store.pendingOps(limit: 10)
        XCTAssertEqual(ops.count, 1) // coalesced, not two ops with the same stale baseVersion
        XCTAssertEqual(ops[0].opId, originalOpId)
        XCTAssertEqual(ops[0].baseVersion, "3")
        XCTAssertEqual(ops[0].data?["title"]?.stringValue, "first")
        XCTAssertEqual(ops[0].data?["body"]?.stringValue, "second")
    }

    func testStageCoalescesUpsertThenDeleteKeepingOpId() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        let originalOpId = await store.pendingOpId(resource: "personal.notes", rowId: "r1")
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .delete))
        let ops = try await store.pendingOps(limit: 10)
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].opId, originalOpId)
        XCTAssertEqual(ops[0].type, .delete)
        XCTAssertNil(ops[0].data)
    }

    func testStageAfterPendingOpsCreatesNewOpWithFreshOpId() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        let firstOps = try await store.pendingOps(limit: 10) // marks the op inflight
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["body": .string("second")])
        )
        let allOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(allOps.count, 2) // the inflight op plus a fresh one — not coalesced
        XCTAssertTrue(allOps.contains { $0.opId == firstOps[0].opId })
        XCTAssertEqual(Set(allOps.map(\.opId)).count, 2)
    }

    func testStageOnUnregisteredResourceThrowsUnknownResourceRatherThanAutoCreating() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        do {
            try await store.stage(LocalMutation(resource: "unknown.resource", rowId: "r1", type: .upsert, data: [:]))
            XCTFail("expected unknownResource")
        } catch SyncStoreFailure.unknownResource(let resource) {
            XCTAssertEqual(resource, "unknown.resource")
        }
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

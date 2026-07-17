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

    func testCompleteAppliedAdoptsNewVersionOntoMirrorRowForSubsequentStage() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        let ops = try await store.pendingOps(limit: 10)
        try await store.complete([SyncPushResult(opId: ops[0].opId, status: .applied, newVersion: "77")])
        let row = await store.row(resource: "personal.notes", id: "r1")
        XCTAssertEqual(row?.syncVersion, "77") // adopted onto the mirror row before the outbox entry was dropped
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("second")])
        )
        let newOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(newOps.count, 1)
        XCTAssertEqual(newOps[0].baseVersion, "77") // subsequent stage() snapshots the adopted version
    }

    /// review fix: an unparseable `newVersion` on an `applied` result must be
    /// skipped (not adopted, not thrown) — parity with GRDBSyncStore. The
    /// outbox entry is still dropped since the server did apply the op.
    func testCompleteAppliedWithUnparseableNewVersionSkipsAdoptionButStillDeletesOutboxRow() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        let ops = try await store.pendingOps(limit: 10)
        try await store.complete([SyncPushResult(opId: ops[0].opId, status: .applied, newVersion: "bogus")])
        let row = await store.row(resource: "personal.notes", id: "r1")
        XCTAssertEqual(row?.syncVersion, "0") // untouched: stage() seeds new rows at syncVersion "0"
        let remaining = try await store.pendingOps(limit: 10)
        XCTAssertTrue(remaining.isEmpty) // outbox entry still dropped — the server did apply the op
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

    /// item (g), InMemory parity with GRDBSyncStore: an unparseable
    /// `syncVersion` must fail loudly rather than being silently accepted
    /// into a mirror row that then lies about its ordering.
    func testApplyWithUnparseableSyncVersionThrowsInvalidChange() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        do {
            try await store.apply(
                [SyncChange(resource: "personal.notes", id: "a", op: .upsert, syncVersion: "not-a-number", data: [:])],
                advancingTo: SyncCursor(rawValue: "c1")
            )
            XCTFail("expected invalidChange")
        } catch SyncStoreFailure.invalidChange {
            // expected
        } catch {
            XCTFail("expected SyncStoreFailure.invalidChange, got \(error)")
        }
        let rowCount = try await store.rowCount(resource: "personal.notes")
        XCTAssertEqual(rowCount, 0) // nothing landed under a coerced version
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

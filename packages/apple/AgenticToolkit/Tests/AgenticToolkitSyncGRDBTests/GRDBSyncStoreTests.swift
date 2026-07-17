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

    func testCompleteAppliedAdoptsNewVersionOntoMirrorRowForSubsequentStage() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        let ops = try await store.pendingOps(limit: 10)
        try await store.complete([SyncPushResult(opId: ops[0].opId, status: .applied, newVersion: "77")])
        let table = try GRDBSyncStore.mirrorTableName(for: "personal.notes")
        let version = try store.database.read { conn in
            try Int.fetchOne(conn, sql: "SELECT sync_version FROM \"\(table)\" WHERE id = ?", arguments: ["r1"])
        }
        XCTAssertEqual(version, 77) // adopted onto the mirror row before the outbox row was deleted
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("second")])
        )
        let newOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(newOps.count, 1)
        XCTAssertEqual(newOps[0].baseVersion, "77") // subsequent stage() snapshots the adopted version
    }

    /// item (g): a pulled `SyncChange.syncVersion` that isn't the `/^\d+$/`
    /// the wire contract guarantees must fail loudly, not silently coerce
    /// to `0` via `Int(...) ?? 0` and corrupt the mirror row's ordering.
    func testApplyWithUnparseableSyncVersionThrowsInvalidChange() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        let batch = [
            SyncChange(resource: "personal.notes", id: "a", op: .upsert, syncVersion: "not-a-number", data: [:])
        ]
        do {
            try await store.apply(batch, advancingTo: SyncCursor(rawValue: "c1"))
            XCTFail("expected invalidChange")
        } catch SyncStoreFailure.invalidChange {
            // expected
        } catch {
            XCTFail("expected SyncStoreFailure.invalidChange, got \(error)")
        }
        // Nothing landed: the bad row didn't sneak in under a coerced version.
        XCTAssertEqual(try store.liveRows(resource: "personal.notes", limit: 10, offset: 0).count, 0)
    }

    /// item (h): a corrupt `_sync_outbox.type` column (bypassing the app —
    /// e.g. a hand-edited row, a future migration bug) must fail loudly
    /// rather than silently default to `.upsert` via `SyncChangeOp(rawValue:)
    /// ?? .upsert`, which could push a delete as an upsert.
    func testPendingOpsWithCorruptTypeColumnThrowsInvalidChange() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: [:]))
        try store.database.write { conn in
            try conn.execute(sql: "UPDATE _sync_outbox SET type = 'bogus' WHERE row_id = ?", arguments: ["r1"])
        }
        do {
            _ = try await store.pendingOps(limit: 10)
            XCTFail("expected invalidChange")
        } catch SyncStoreFailure.invalidChange {
            // expected
        } catch {
            XCTFail("expected SyncStoreFailure.invalidChange, got \(error)")
        }
    }

    func testStageCoalescesUpsertThenUpsertKeepingOpIdAndBaseVersion() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.apply(
            [SyncChange(resource: "personal.notes", id: "r1", op: .upsert, syncVersion: "3", data: [:])],
            advancingTo: SyncCursor(rawValue: "c3")
        )
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        let originalOpId = try store.database.read { conn in
            try String.fetchOne(conn, sql: "SELECT op_id FROM _sync_outbox WHERE row_id = ?", arguments: ["r1"])
        }
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
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        let originalOpId = try store.database.read { conn in
            try String.fetchOne(conn, sql: "SELECT op_id FROM _sync_outbox WHERE row_id = ?", arguments: ["r1"])
        }
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .delete))
        let ops = try await store.pendingOps(limit: 10)
        XCTAssertEqual(ops.count, 1)
        XCTAssertEqual(ops[0].opId, originalOpId)
        XCTAssertEqual(ops[0].type, .delete)
        XCTAssertNil(ops[0].data)
    }

    func testStageAfterPendingOpsCreatesNewOpWithFreshOpId() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        let firstOps = try await store.pendingOps(limit: 10) // marks the op inflight
        XCTAssertEqual(firstOps.count, 1)
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["body": .string("second")])
        )
        let allOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(allOps.count, 2) // the inflight op plus a fresh one — not coalesced
        XCTAssertTrue(allOps.contains { $0.opId == firstOps[0].opId })
        XCTAssertEqual(Set(allOps.map(\.opId)).count, 2)
    }

    func testPendingOpsReturnsInsertionRowidOrder() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: [:]))
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r2", type: .upsert, data: [:]))
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r3", type: .upsert, data: [:]))
        let ops = try await store.pendingOps(limit: 10)
        XCTAssertEqual(ops.map(\.rowId), ["r1", "r2", "r3"])
    }

    func testPendingOpsReturnsInflightOpsAgainUntilCompleted() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: [:]))
        let first = try await store.pendingOps(limit: 10)
        let second = try await store.pendingOps(limit: 10) // still inflight: must be handed out again
        XCTAssertEqual(first.map(\.opId), second.map(\.opId))
    }

    func testStageOnUnregisteredResourceThrowsUnknownResource() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        do {
            try await store.stage(LocalMutation(resource: "unknown.resource", rowId: "r1", type: .upsert, data: [:]))
            XCTFail("expected unknownResource")
        } catch SyncStoreFailure.unknownResource(let resource) {
            XCTAssertEqual(resource, "unknown.resource")
        }
    }

    func testLiveRowsOnUnregisteredResourceThrowsUnknownResource() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes]) // some resource IS registered — just not this one
        do {
            _ = try store.liveRows(resource: "unknown.resource", limit: 10, offset: 0)
            XCTFail("expected unknownResource")
        } catch SyncStoreFailure.unknownResource(let resource) {
            XCTAssertEqual(resource, "unknown.resource")
        }
    }

    func testLiveRowOnUnregisteredResourceThrowsUnknownResource() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes]) // some resource IS registered — just not this one
        do {
            _ = try store.liveRow(resource: "unknown.resource", id: "r1")
            XCTFail("expected unknownResource")
        } catch SyncStoreFailure.unknownResource(let resource) {
            XCTAssertEqual(resource, "unknown.resource")
        }
    }

    func testMirrorTableNameRejectsResourceWithCharactersOutsideTheSafeSet() throws {
        XCTAssertThrowsError(try GRDBSyncStore.mirrorTableName(for: "personal.notes; DROP TABLE _sync_state;--"))
        XCTAssertThrowsError(try GRDBSyncStore.mirrorTableName(for: "Personal.Notes")) // uppercase not allowed
        XCTAssertThrowsError(try GRDBSyncStore.mirrorTableName(for: ""))
        XCTAssertNoThrow(try GRDBSyncStore.mirrorTableName(for: "personal.notes_v2"))
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

    func testPurgeForIdentityChangeClearsMirrorsCursorAndOutboxButKeepsRegistrations() async throws {
        let store = try makeStore()
        try await store.prepare(resources: [notes])
        try await store.apply(
            [SyncChange(
                resource: "personal.notes", id: "s1", op: .upsert, syncVersion: "1", data: ["title": .string("A")]
            )],
            advancingTo: SyncCursor(rawValue: "c1")
        )
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: [:]))
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r2", type: .upsert, data: [:]))
        let ops = try await store.pendingOps(limit: 10) // marks both inflight
        try await store.complete([SyncPushResult(opId: ops[1].opId, status: .rejected, reason: "invalid_data")])
        // r1's op is still inflight (unresolved), r2's op is now quarantined —
        // both belong to the identity that's about to depart.
        let beforePurge = try store.status()
        XCTAssertEqual(beforePurge.outboxDepth, 1)
        XCTAssertEqual(beforePurge.quarantinedDepth, 1)

        try await store.purgeForIdentityChange()

        let status = try store.status()
        XCTAssertEqual(status.outboxDepth, 0)
        XCTAssertEqual(status.quarantinedDepth, 0) // quarantined ops are purged too, not just pending/inflight
        let cursor = try await store.cursor()
        XCTAssertNil(cursor)
        XCTAssertEqual(try store.liveRows(resource: "personal.notes", limit: 10, offset: 0).count, 0)
        // registrations are app-level, not per-identity
        XCTAssertEqual(try store.registeredResources(), ["personal.notes"])

        // prepare intact: the next identity's staging works without re-registering.
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r3", type: .upsert, data: [:]))
        let opsAfterPurge = try await store.pendingOps(limit: 10)
        XCTAssertEqual(opsAfterPurge.count, 1)
        XCTAssertEqual(opsAfterPurge[0].rowId, "r3")
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

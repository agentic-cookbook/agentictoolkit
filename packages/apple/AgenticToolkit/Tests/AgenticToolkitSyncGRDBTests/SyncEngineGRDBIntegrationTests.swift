import XCTest
import GRDB
import AgenticToolkitDatabase
import AgenticToolkitSync
@testable import AgenticToolkitSyncGRDB

/// The engine (Task 4) had zero tests against a real store — every
/// SyncEngineTests case runs against InMemorySyncStore. This file closes
/// that gap for the specific defect the fix wave targets: two offline edits
/// to the same row must coalesce into ONE outbox op (see
/// GRDBSyncStore.stage), so the engine never pushes a pair of ops sharing a
/// stale baseVersion that would self-conflict on the server.
final class SyncEngineGRDBIntegrationTests: XCTestCase {

    private var path: String!

    override func setUpWithError() throws {
        path = NSTemporaryDirectory() + "sync-engine-\(UUID().uuidString).db"
    }

    override func tearDownWithError() throws {
        for suffix in ["", "-wal", "-shm"] {
            try? FileManager.default.removeItem(atPath: path + suffix)
        }
    }

    private let notes = SyncResource(resource: "personal.notes", schemaVersion: 1)

    private func engineConfig() -> SyncEngineConfiguration {
        SyncEngineConfiguration(
            deviceId: "test-device", pullLimit: 10, pushBatchSize: 5, baseBackoff: 0.01, maxBackoff: 0.05
        )
    }

    func testOfflineCreateThenEditCoalescesIntoOnePushOpCarryingTheCreateOpId() async throws {
        let store = GRDBSyncStore(database: try BoundedDatabase(path: path))
        let transport = ScriptedSyncTransport(pulls: [
            .success(SyncPullResponse(manifest: [notes], changes: [], cursor: "c0", hasMore: false))
        ])
        let engine = SyncEngine(store: store, transport: transport, configuration: engineConfig())

        // First cycle: pull only. Establishes the manifest (mirror table) via
        // the scripted pull — the "hosts must prepare before staging
        // offline" contract (SyncStore.stage doc comment).
        await engine.syncNow(reason: .manual)

        // Offline create, then an offline edit to the SAME row, before any
        // push happens.
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("first")])
        )
        // Peek the create's opId via a raw read — NOT via pendingOps, which
        // would mark it inflight and defeat the coalescing this test proves.
        let createOpId = try store.database.read { conn in
            try String.fetchOne(
                conn, sql: "SELECT op_id FROM _sync_outbox WHERE resource = ? AND row_id = ?",
                arguments: ["personal.notes", "r1"]
            )
        }
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["body": .string("edited")])
        )

        await transport.enqueuePush(.success(SyncPushResponse(
            results: [SyncPushResult(opId: createOpId ?? "", status: .applied)], watermark: "1"
        )))

        // Second cycle: pushes the (coalesced) outbox.
        await engine.syncNow(reason: .manual)

        let opsForRow = await transport.pushedRequests.flatMap(\.ops).filter { $0.rowId == "r1" }
        XCTAssertEqual(opsForRow.count, 1, "the create and the edit must coalesce into a single pushed op")
        XCTAssertEqual(opsForRow.first?.opId, createOpId)
        XCTAssertEqual(opsForRow.first?.data?["title"]?.stringValue, "first")
        XCTAssertEqual(opsForRow.first?.data?["body"]?.stringValue, "edited")

        let remaining = try await store.pendingOps(limit: 10)
        XCTAssertEqual(remaining.count, 0)
        let row = try store.liveRow(resource: "personal.notes", id: "r1")
        XCTAssertNotNil(row)
    }
}

import XCTest
@testable import AgenticToolkitSync

final class SyncEngineTests: XCTestCase {

    private func engine(
        store: InMemorySyncStore = InMemorySyncStore(),
        transport: ScriptedSyncTransport
    ) -> (SyncEngine, InMemorySyncStore) {
        let config = SyncEngineConfiguration(
            deviceId: "test-device", pullLimit: 10, pushBatchSize: 5, baseBackoff: 0.01, maxBackoff: 0.05
        )
        return (SyncEngine(store: store, transport: transport, configuration: config), store)
    }

    private func pullPage(
        _ changes: [SyncChange], cursor: String, hasMore: Bool
    ) -> ScriptedSyncTransport.Outcome<SyncPullResponse> {
        .success(SyncPullResponse(
            manifest: [SyncResource(resource: "personal.notes", schemaVersion: 1)],
            changes: changes, cursor: cursor, hasMore: hasMore
        ))
    }

    func testPullLoopsWhileHasMoreAndAdvancesCursorPerBatch() async throws {
        let transport = ScriptedSyncTransport(pulls: [
            pullPage(
                [SyncChange(resource: "personal.notes", id: "a", op: .upsert, syncVersion: "1", data: [:])],
                cursor: "c1", hasMore: true
            ),
            pullPage(
                [SyncChange(resource: "personal.notes", id: "b", op: .upsert, syncVersion: "2", data: [:])],
                cursor: "c2", hasMore: false
            )
        ])
        let (engine, store) = engine(transport: transport)
        await engine.syncNow(reason: .manual)
        let cursor = try await store.cursor()
        XCTAssertEqual(cursor?.rawValue, "c2")
        let noteCount = try await store.rowCount(resource: "personal.notes")
        XCTAssertEqual(noteCount, 2)
        let cursorsSent = await transport.pullCursors
        XCTAssertEqual(cursorsSent.map { $0?.rawValue }, [nil, "c1"])
    }

    func testPushDrainsOutboxAndAppliesConflictCurrentLocally() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("mine")])
        )
        let ops = try await store.pendingOps(limit: 10)
        let serverRow: [String: JSONValue] = [
            "id": .string("r1"), "title": .string("theirs"), "sync_version": .number(9), "deleted_at": .null
        ]
        let transport = ScriptedSyncTransport(pushes: [
            .success(SyncPushResponse(
                results: [
                    SyncPushResult(
                        opId: ops[0].opId, status: .conflict, reason: "stale_base_version", current: serverRow
                    )
                ],
                watermark: "9"
            ))
        ])
        let (engine, _) = engine(store: store, transport: transport)
        await engine.syncNow(reason: .manual)
        let remainingOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(remainingOps.count, 0)
        let row = await store.row(resource: "personal.notes", id: "r1")
        XCTAssertEqual(row?.data["title"]?.stringValue, "theirs") // LWW: server row adopted
    }

    func testUnauthorizedPausesUntilManualKick() async throws {
        let transport = ScriptedSyncTransport(pulls: [.failure(.unauthorized)])
        let (engine, _) = engine(transport: transport)
        await engine.syncNow(reason: .manual)
        await engine.syncNow(reason: .periodic) // paused: must NOT hit the transport
        let cursors = await transport.pullCursors
        XCTAssertEqual(cursors.count, 1)
        await transport.enqueuePull(pullPage([], cursor: "c0", hasMore: false))
        await engine.syncNow(reason: .manual)   // manual clears the pause
        let after = await transport.pullCursors
        XCTAssertEqual(after.count, 2)
    }

    func testResyncRequiredResetsMirrorPreservingOutboxThenRepulls() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.apply(
            [SyncChange(resource: "personal.notes", id: "old", op: .upsert, syncVersion: "1", data: [:])],
            advancingTo: SyncCursor(rawValue: "stale")
        )
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "mine", type: .upsert, data: [:]))
        let transport = ScriptedSyncTransport(pulls: [
            .failure(.resyncRequired),
            pullPage(
                [SyncChange(resource: "personal.notes", id: "fresh", op: .upsert, syncVersion: "50", data: [:])],
                cursor: "c50", hasMore: false
            )
        ])
        let (engine, _) = engine(store: store, transport: transport)
        await engine.syncNow(reason: .manual)
        let freshRow = await store.row(resource: "personal.notes", id: "fresh")
        XCTAssertNotNil(freshRow)
        let oldRow = await store.row(resource: "personal.notes", id: "old")
        XCTAssertNil(oldRow)
        let remainingOps = try await store.pendingOps(limit: 10)
        XCTAssertGreaterThanOrEqual(remainingOps.count, 1) // outbox replayed/preserved
    }

    func testTransportFailureLeavesOutboxIntact() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: [:]))
        let transport = ScriptedSyncTransport(
            pulls: [pullPage([], cursor: "c0", hasMore: false)],
            pushes: [.failure(.transport("boom"))]
        )
        let (engine, _) = engine(store: store, transport: transport)
        await engine.syncNow(reason: .manual)
        let remainingOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(remainingOps.count, 1)
    }
}

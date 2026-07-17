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
            "id": .string("r1"), "title": .string("theirs"), "sync_version": .number(9),
            "sync_stamped_at": .string("2026-07-16T00:00:00Z"), "deleted_at": .null
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
        XCTAssertEqual(row?.syncVersion, "9")
        // p2-Minor4: bookkeeping columns must not leak into the mirror's `data`.
        XCTAssertNil(row?.data["sync_version"])
        XCTAssertNil(row?.data["sync_stamped_at"])
    }

    func testConflictWithoutCurrentIsQuarantinedNotSilentlyDropped() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("mine")])
        )
        let ops = try await store.pendingOps(limit: 10)
        let transport = ScriptedSyncTransport(pushes: [
            .success(SyncPushResponse(
                results: [
                    SyncPushResult(opId: ops[0].opId, status: .conflict, reason: "server_row_missing", current: nil)
                ],
                watermark: "9"
            ))
        ])
        let (engine, _) = engine(store: store, transport: transport)
        await engine.syncNow(reason: .manual)
        let remainingOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(remainingOps.count, 0) // resolved, not retried forever
        let quarantined = await store.quarantined
        XCTAssertEqual(quarantined.map(\.opId), [ops[0].opId]) // quarantined, not silently dropped
        let row = await store.row(resource: "personal.notes", id: "r1")
        XCTAssertEqual(row?.data["title"]?.stringValue, "mine") // nothing to adopt: local row untouched
    }

    func testConflictWithUnrepresentableSyncVersionSkipsAdoptionButStillResolves() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("mine")])
        )
        let ops = try await store.pendingOps(limit: 10)
        let serverRow: [String: JSONValue] = [
            "id": .string("r1"), "title": .string("theirs"), "sync_version": .number(.infinity), "deleted_at": .null
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
        XCTAssertEqual(remainingOps.count, 0) // op still resolves — no infinite spin
        let row = await store.row(resource: "personal.notes", id: "r1")
        XCTAssertEqual(row?.data["title"]?.stringValue, "mine") // adoption skipped: local row untouched
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

    func testResyncRequiredResetsMirrorPreservingOutboxThenRepullsAndReplaysOutbox() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.apply(
            [SyncChange(resource: "personal.notes", id: "old", op: .upsert, syncVersion: "1", data: [:])],
            advancingTo: SyncCursor(rawValue: "stale")
        )
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "mine", type: .upsert, data: [:]))
        let stagedOpId = try await store.pendingOps(limit: 10)[0].opId
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
        let pushedOpIds = await transport.pushedRequests.flatMap(\.ops).map(\.opId)
        XCTAssertEqual(pushedOpIds, [stagedOpId]) // outbox survived the reset and replayed under its original opId
        let remainingOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(remainingOps.count, 0)     // acknowledged, not dropped
    }

    /// item (e): a second failure (401) hitting the resync's own re-pull must
    /// be handled with the same auth-pause semantics as an ordinary cycle's
    /// unauthorized — not folded into performResync's generic `.failed` +
    /// backoff-retry catch-all.
    func testUnauthorizedDuringResyncRepullEmitsAuthRequiredAndPauses() async throws {
        let transport = ScriptedSyncTransport(pulls: [
            .failure(.resyncRequired),
            .failure(.unauthorized)
        ])
        let (engine, _) = engine(transport: transport)
        await engine.syncNow(reason: .manual)
        await engine.syncNow(reason: .periodic) // authPaused: must NOT hit the transport again
        let cursors = await transport.pullCursors
        XCTAssertEqual(cursors.count, 2) // the resyncRequired pull, then the resync's re-pull — no third attempt
        await engine.stop()
        var events: [SyncEvent] = []
        for await event in engine.events { events.append(event) }
        XCTAssertTrue(events.contains(.resyncPerformed))
        XCTAssertTrue(events.contains(.authRequired))
        XCTAssertFalse(events.contains { if case .failed = $0 { return true }; return false }) // no backoff retry
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
        await engine.stop() // cancels the armed retry-backoff task before it can fire mid-assertion
        let remainingOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(remainingOps.count, 1)
    }

    // MARK: - pause()/resume()

    func testPauseDuringInFlightCycleWaitsForCompletion() async throws {
        let transport = GatedPullTransport()
        let config = SyncEngineConfiguration(
            deviceId: "test-device", pullLimit: 10, pushBatchSize: 5, baseBackoff: 0.01, maxBackoff: 0.05
        )
        let engine = SyncEngine(store: InMemorySyncStore(), transport: transport, configuration: config)

        let cycleTask = Task { await engine.syncNow(reason: .manual) }
        await transport.waitUntilPullStarted() // the cycle is now blocked inside the pull call

        let pauseReturned = Flag()
        let pauseTask = Task {
            await engine.pause()
            await pauseReturned.set()
        }
        try await Task.sleep(for: .milliseconds(50)) // let pauseTask reach and suspend on the continuation
        let returnedBeforeRelease = await pauseReturned.get()
        XCTAssertFalse(returnedBeforeRelease) // still waiting: the cycle hasn't completed yet

        await transport.release()
        await cycleTask.value
        await pauseTask.value
        let returnedAfterRelease = await pauseReturned.get()
        XCTAssertTrue(returnedAfterRelease) // pause() only returned once the cycle finished
    }

    func testKicksWhilePausedDoNotPull() async throws {
        let transport = ScriptedSyncTransport(pulls: [pullPage([], cursor: "c0", hasMore: false)])
        let (engine, _) = engine(transport: transport)
        await engine.pause() // not running: returns immediately
        await engine.kick(reason: .periodic)
        await engine.syncNow(reason: .manual)
        let cursors = await transport.pullCursors
        XCTAssertTrue(cursors.isEmpty) // both no-op while paused: nothing buffered, nothing pulled
    }

    func testResumeThenKickSyncs() async throws {
        let transport = ScriptedSyncTransport(pulls: [pullPage([], cursor: "c0", hasMore: false)])
        let (engine, _) = engine(transport: transport)
        await engine.pause()
        await engine.kick(reason: .periodic) // dropped: pause() buffers nothing
        await engine.resume()
        await engine.kick(reason: .manual)
        let cursors = await transport.pullCursors
        XCTAssertEqual(cursors.count, 1)
    }
}

/// Test-only actor flag: cheaper than a second gated transport for the
/// simple "did this async call return yet" checks pause() tests need.
private actor Flag {
    private var value = false
    func set() { value = true }
    func get() -> Bool { value }
}

/// SyncTransport fake whose `pull(cursor:limit:)` blocks on a manually
/// resumed continuation, so a test can deterministically observe a sync
/// cycle "in flight" (mid pull) before releasing it — needed to test
/// `pause()`'s "suspends until the running cycle completes" contract, which
/// `ScriptedSyncTransport`'s always-immediately-resolving fakes can't do.
private actor GatedPullTransport: SyncTransport {
    private var startedContinuation: CheckedContinuation<Void, Never>?
    private var releaseContinuation: CheckedContinuation<Void, Never>?

    func waitUntilPullStarted() async {
        await withCheckedContinuation { startedContinuation = $0 }
    }

    func release() {
        releaseContinuation?.resume()
        releaseContinuation = nil
    }

    func pull(cursor: SyncCursor?, limit: Int) async throws -> SyncPullResponse {
        startedContinuation?.resume()
        startedContinuation = nil
        await withCheckedContinuation { releaseContinuation = $0 }
        return SyncPullResponse(manifest: [], changes: [], cursor: "gated", hasMore: false)
    }

    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse {
        SyncPushResponse(results: request.ops.map { SyncPushResult(opId: $0.opId, status: .applied) }, watermark: "0")
    }
}

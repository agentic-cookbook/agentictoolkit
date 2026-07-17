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

    /// review fix: a server that keeps returning 410 on every pull (GC
    /// horizon persistently ahead of us, or just misbehaving) must not drive
    /// `performResync` into an unbounded hot reset+pull loop. After the
    /// first immediate nested retry, every further 410 should route through
    /// the normal backoff/retry path instead of recursing again.
    ///
    /// Deflaked: no wall-clock window or fuzzy pull-count range. `syncNow`
    /// is driven directly, three times, instead of waiting on the engine's
    /// own scheduled retry timer — each direct call exercises the bounded
    /// nested-resync path fully synchronously (the one allowed nested retry
    /// happens inline, before that call returns), so the pull count after
    /// every call is exact. `baseBackoff`/`maxBackoff` are set far longer
    /// than this test can possibly run, so the retry task armed by each
    /// cycle's `scheduleRetry()` never fires during the test — it's simply
    /// canceled by the final `engine.stop()`.
    func testRepeatedResyncRequiredBacksOffInsteadOfHanging() async throws {
        let transport = AlwaysResyncTransport()
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(
            LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: ["title": .string("offline")])
        )
        let config = SyncEngineConfiguration(
            deviceId: "test-device", pullLimit: 10, pushBatchSize: 5, baseBackoff: 10, maxBackoff: 10
        )
        let engine = SyncEngine(store: store, transport: transport, configuration: config)

        // Cycle 1: syncNow's own pull, performResync's re-pull, and the ONE
        // allowed nested retry's re-pull — all synchronous within this
        // single call. The bound engages after that: exactly 3 pulls, then
        // backs off instead of recursing a third time.
        await engine.syncNow(reason: .manual)
        let pullCountAfterCycle1 = await transport.pullCount
        XCTAssertEqual(pullCountAfterCycle1, 3)

        // Cycles 2 and 3, driven directly rather than via the scheduled
        // retry: consecutiveResyncs never resets against a transport that
        // always returns resyncRequired, so the bound engages immediately on
        // every later cycle too — exactly 2 pulls each, never climbing back
        // toward 3.
        await engine.syncNow(reason: .manual)
        let pullCountAfterCycle2 = await transport.pullCount
        XCTAssertEqual(pullCountAfterCycle2, 5)
        await engine.syncNow(reason: .manual)
        let pullCountAfterCycle3 = await transport.pullCount
        XCTAssertEqual(pullCountAfterCycle3, 7)

        await engine.stop() // cancels the (10s-out, never-fired) retry task armed by cycle 3

        var events: [SyncEvent] = []
        for await event in engine.events { events.append(event) }
        let failedReasons = events.compactMap { event -> String? in
            if case .failed(let reason) = event { return reason }
            return nil
        }
        XCTAssertEqual(failedReasons.count, 3) // exactly one bound-triggered failure per cycle above
        XCTAssertTrue(failedReasons.allSatisfy { $0.contains("resync_required") })

        let remainingOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(remainingOps.count, 1) // outbox intact throughout
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

    // MARK: - backoff / spin-guard / quarantine (item i, j)

    /// item (i): consecutive pull failures must auto-retry via the engine's
    /// own backoff scheduling (no manual re-kick needed), and a success in
    /// between must reset consecutiveFailures — proven by the very next
    /// failure's retry landing in the same (exponent-1) backoff window as
    /// failure #1's own retry, not the much larger window a still-climbing
    /// counter would have produced.
    ///
    /// Deflaked: no absolute wall-clock threshold. Both the exponent-1
    /// baseline (failure #1 → its own auto-retry) and the post-reset gap
    /// (the fresh failure after the intervening success → its auto-retry)
    /// are measured from the same run, and the assertion compares their
    /// RATIO — robust to CI scheduling jitter that an absolute-ms threshold
    /// is not, while still failing hard on a real regression (an un-reset
    /// counter would put the post-reset gap at exponent 4, ~8x the
    /// baseline, comfortably over the ratio ceiling below).
    func testConsecutivePullFailuresBackOffThenResetOnSuccess() async throws {
        let config = SyncEngineConfiguration(
            deviceId: "test-device", pullLimit: 10, pushBatchSize: 5, baseBackoff: 0.02, maxBackoff: 5
        )
        let transport = ScriptedSyncTransport(pulls: [
            .failure(.transport("e1")),
            .failure(.transport("e2")),
            .failure(.transport("e3")),
            pullPage([], cursor: "c0", hasMore: false), // success: resets consecutiveFailures
            .failure(.transport("e4")),                 // a fresh failure right after the reset
            pullPage([], cursor: "c0", hasMore: false)   // its auto-retry
        ])
        let engine = SyncEngine(store: InMemorySyncStore(), transport: transport, configuration: config)

        func waitForPullCount(_ target: Int) async -> Date? {
            let deadline = Date().addingTimeInterval(3)
            while Date() < deadline {
                if await transport.pullCursors.count >= target { return Date() }
                try? await Task.sleep(for: .milliseconds(2))
            }
            return nil
        }

        let firstFailureAt = Date()
        await engine.syncNow(reason: .manual) // fires failure #1; scheduleRetry auto-drives 2, 3, then success
        let secondPullAt = await waitForPullCount(2) // failure #1's own auto-retry: the exponent-1 baseline
        XCTAssertNotNil(secondPullAt)
        let baselineGap = secondPullAt!.timeIntervalSince(firstFailureAt)

        let successAt = await waitForPullCount(4)
        XCTAssertNotNil(successAt) // the automatic retry chain reached the scripted success unaided

        let nextFailureAt = Date()
        await engine.syncNow(reason: .manual) // a fresh failure, now that consecutiveFailures was reset
        let retriedAt = await waitForPullCount(6)
        XCTAssertNotNil(retriedAt) // this failure also auto-retried
        await engine.stop() // no more scripted outcomes remain; nothing left to cancel, but tidy up regardless

        let resetGap = retriedAt!.timeIntervalSince(nextFailureAt)
        // Relative, not absolute: the reset gap should land close to the
        // exponent-1 baseline (same backoff window), not climb toward the
        // exponent-4 window an un-reset counter would produce (~8x).
        XCTAssertLessThan(resetGap, baselineGap * 3)

        var events: [SyncEvent] = []
        for await event in engine.events { events.append(event) }
        let failedCount = events.filter { if case .failed = $0 { return true }; return false }.count
        XCTAssertEqual(failedCount, 4) // 3 pre-success + 1 post-success
    }

    /// item (i) spin guard: a push response whose opId matches nothing in
    /// the outbox must fail loudly (SyncEngineError.pushMadeNoProgress)
    /// rather than re-fetching and re-pushing the same unresolved batch
    /// forever.
    func testPushResponseWithBogusOpIdFailsInsteadOfSpinning() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: [:]))
        let transport = ScriptedSyncTransport(
            pulls: [pullPage([], cursor: "c0", hasMore: false)],
            pushes: [.success(SyncPushResponse(
                results: [SyncPushResult(opId: "bogus-op-id-not-in-outbox", status: .applied)], watermark: "0"
            ))]
        )
        let (engine, _) = engine(store: store, transport: transport)
        await engine.syncNow(reason: .manual)
        await engine.stop() // cancels the resulting backoff retry before it can fire mid-assertion
        let remainingOps = try await store.pendingOps(limit: 10)
        XCTAssertEqual(remainingOps.count, 1) // outbox intact: nothing was (wrongly) resolved
        var events: [SyncEvent] = []
        for await event in engine.events { events.append(event) }
        XCTAssertTrue(events.contains { if case .failed = $0 { return true }; return false }) // no hang, no spin
    }

    /// item (j): a server-rejected push result must land the op in the
    /// store's quarantine, not silently vanish or get retried under its
    /// original opId on the next cycle.
    func testRejectedPushResultQuarantinesOpAndIsNotRetriedNextCycle() async throws {
        let store = InMemorySyncStore()
        try await store.prepare(resources: [SyncResource(resource: "personal.notes", schemaVersion: 1)])
        try await store.stage(LocalMutation(resource: "personal.notes", rowId: "r1", type: .upsert, data: [:]))
        let opId = await store.pendingOpId(resource: "personal.notes", rowId: "r1")
        let transport = ScriptedSyncTransport(
            pulls: [pullPage([], cursor: "c0", hasMore: false), pullPage([], cursor: "c0", hasMore: false)],
            pushes: [.success(SyncPushResponse(
                results: [SyncPushResult(opId: opId!, status: .rejected, reason: "invalid_data")], watermark: "0"
            ))]
        )
        let (engine, _) = engine(store: store, transport: transport)
        await engine.syncNow(reason: .manual) // rejects and quarantines
        let quarantined = await store.quarantined
        XCTAssertEqual(quarantined.map(\.opId), [opId])
        let remainingAfterFirstCycle = try await store.pendingOps(limit: 10)
        XCTAssertTrue(remainingAfterFirstCycle.isEmpty) // resolved, not left pending for a retry

        await engine.syncNow(reason: .manual) // second cycle: nothing left in the outbox to push
        let pushedRequests = await transport.pushedRequests
        XCTAssertEqual(pushedRequests.count, 1) // never re-pushed under its original (or any) opId
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

    // MARK: - syncNow spinner join

    /// syncNow's new contract: a caller that coalesces into an already-
    /// running cycle no longer returns immediately — it suspends until the
    /// cycle it joined finishes, exactly like `pause()` already does. This
    /// is what makes syncNow an honest signal for pull-to-refresh spinners
    /// and BG-task completion handlers. Two concurrent syncNow calls against
    /// a gated transport: neither returns before the gate opens; both
    /// return once the joined (first) cycle completes; the second call's
    /// coalesced follow-up cycle then runs (per the documented "may still
    /// run after return" clause), landing the transport at exactly 2 pulls.
    func testConcurrentSyncNowCallsBothWaitForTheJoinedCycleThenFollowUpRuns() async throws {
        let transport = GatedPullTransport()
        let config = SyncEngineConfiguration(
            deviceId: "test-device", pullLimit: 10, pushBatchSize: 5, baseBackoff: 0.01, maxBackoff: 0.05
        )
        let engine = SyncEngine(store: InMemorySyncStore(), transport: transport, configuration: config)

        let firstReturned = Flag()
        let firstTask = Task {
            await engine.syncNow(reason: .manual)
            await firstReturned.set()
        }
        await transport.waitUntilPullStarted() // the first cycle is now blocked inside the gated pull

        // A second, concurrent syncNow call coalesces into the running cycle
        // (same as before) but, per the new contract, suspends rather than
        // returning immediately.
        let secondReturned = Flag()
        let secondTask = Task {
            await engine.syncNow(reason: .periodic)
            await secondReturned.set()
        }
        try await Task.sleep(for: .milliseconds(50)) // let secondTask reach and suspend on the shared continuation

        let firstReturnedEarly = await firstReturned.get()
        let secondReturnedEarly = await secondReturned.get()
        XCTAssertFalse(firstReturnedEarly)  // still gated
        XCTAssertFalse(secondReturnedEarly) // joined the wait, not returned early

        await transport.release() // lets the gated pull — and the joined cycle — complete
        await firstTask.value
        await secondTask.value
        let firstReturnedAfter = await firstReturned.get()
        let secondReturnedAfter = await secondReturned.get()
        XCTAssertTrue(firstReturnedAfter)
        XCTAssertTrue(secondReturnedAfter) // both returned once the cycle they joined finished

        let pullCount = await transport.pullCount
        // 1 pull for the cycle both calls joined, + 1 for the coalesced
        // follow-up cycle the second call's pendingReason queued — exactly
        // the "a coalesced follow-up cycle may still run after return"
        // semantics, not a third or unbounded number of cycles.
        XCTAssertEqual(pullCount, 2)
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
/// Only the FIRST `pull` call gates on `release()`; any subsequent calls
/// (e.g. a syncNow spinner-join's coalesced follow-up cycle) resolve
/// immediately — the gate exists to observe one cycle in flight, not to
/// block every cycle a test happens to trigger.
private actor GatedPullTransport: SyncTransport {
    private var startedContinuation: CheckedContinuation<Void, Never>?
    private var releaseContinuation: CheckedContinuation<Void, Never>?
    // review fix: without this flag, a caller whose `syncNow` Task happens to
    // reach `pull()` before the test's `waitUntilPullStarted()` call installs
    // its continuation would see `startedContinuation` still nil in `pull()`
    // (so the `resume()` there is a no-op), and then suspend forever once
    // `waitUntilPullStarted()` finally runs and awaits a continuation nobody
    // will ever resume. Recording that `pull()` already happened lets
    // `waitUntilPullStarted()` return immediately instead of racing it.
    private var started = false
    private var gateConsumed = false
    private(set) var pullCount = 0

    func waitUntilPullStarted() async {
        if started { return }
        await withCheckedContinuation { startedContinuation = $0 }
    }

    func release() {
        releaseContinuation?.resume()
        releaseContinuation = nil
    }

    func pull(cursor: SyncCursor?, limit: Int) async throws -> SyncPullResponse {
        pullCount += 1
        started = true
        startedContinuation?.resume()
        startedContinuation = nil
        if !gateConsumed {
            gateConsumed = true
            await withCheckedContinuation { releaseContinuation = $0 }
        }
        return SyncPullResponse(manifest: [], changes: [], cursor: "gated", hasMore: false)
    }

    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse {
        SyncPushResponse(results: request.ops.map { SyncPushResult(opId: $0.opId, status: .applied) }, watermark: "0")
    }
}

/// SyncTransport fake whose `pull` always throws `.resyncRequired` — used to
/// prove `performResync`'s recursion bound actually bounds it, rather than
/// scripting a fixed-length failure list (which can't distinguish "bounded"
/// from "just as long as the script").
private actor AlwaysResyncTransport: SyncTransport {
    private(set) var pullCount = 0

    func pull(cursor: SyncCursor?, limit: Int) async throws -> SyncPullResponse {
        pullCount += 1
        throw SyncTransportError.resyncRequired
    }

    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse {
        SyncPushResponse(results: request.ops.map { SyncPushResult(opId: $0.opId, status: .applied) }, watermark: "0")
    }
}

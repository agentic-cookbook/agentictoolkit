import Foundation

public struct SyncEngineConfiguration: Sendable {
    public var deviceId: String
    public var pullLimit: Int
    public var pushBatchSize: Int
    public var baseBackoff: TimeInterval
    public var maxBackoff: TimeInterval

    public init(
        deviceId: String,
        pullLimit: Int = 500,
        pushBatchSize: Int = 100,
        baseBackoff: TimeInterval = 2,
        maxBackoff: TimeInterval = 3600
    ) {
        self.deviceId = deviceId
        self.pullLimit = pullLimit
        self.pushBatchSize = pushBatchSize
        self.baseBackoff = baseBackoff
        self.maxBackoff = maxBackoff
    }
}

/// The sync state machine (spec §Engine): kick → pull loop → push loop →
/// conflict adoption (LWW/delete-wins) → idle. Owns no credentials; the
/// transport does. Failures back off exponentially and never drop outbox ops.
public actor SyncEngine {

    private let store: any SyncStore
    private let transport: any SyncTransport
    private let config: SyncEngineConfiguration

    private var running = false
    private var pendingReason: SyncKickReason?
    private var authPaused = false
    private var hostPaused = false
    private var pauseWaiters: [CheckedContinuation<Void, Never>] = []
    private var consecutiveFailures = 0
    private var triggerTasks: [Task<Void, Never>] = []
    private var retryTask: Task<Void, Never>?

    public nonisolated let events: AsyncStream<SyncEvent>
    private let eventContinuation: AsyncStream<SyncEvent>.Continuation

    public init(store: any SyncStore, transport: any SyncTransport, configuration: SyncEngineConfiguration) {
        self.store = store
        self.transport = transport
        self.config = configuration
        // .bufferingNewest(256), not .unbounded: protects a host that
        // constructs an engine but never subscribes to `events` (or stops
        // subscribing) from an unbounded memory leak — every cycle yields
        // several events. Both shipped hosts (BitBag, the adhd daemon)
        // drain the stream continuously, so 256 is far more than either
        // needs in practice; this is a backstop, not a working limit, and
        // the "hosts must drain" obligation still stands documented here.
        (self.events, self.eventContinuation) = AsyncStream.makeStream(
            of: SyncEvent.self,
            bufferingPolicy: .bufferingNewest(256)
        )
    }

    public func attach(_ trigger: any SyncTriggerSource) {
        let task = Task { [weak self] in
            for await reason in trigger.kicks {
                await self?.kick(reason: reason)
            }
        }
        triggerTasks.append(task)
    }

    public func stop() {
        for task in triggerTasks { task.cancel() }
        triggerTasks = []
        retryTask?.cancel()
        retryTask = nil
        eventContinuation.finish()
    }

    /// Fire-and-forget entry point: coalesces into the running cycle.
    public func kick(reason: SyncKickReason) async {
        guard !hostPaused else { return }
        if running {
            pendingReason = pendingReason ?? reason
            return
        }
        await syncNow(reason: reason)
    }

    /// Pauses the engine for identity-boundary operations (e.g. a sign-out
    /// purge): call this, mutate the store, then call `resume()`. Sets a
    /// `hostPaused` flag that makes `kick`/`syncNow` no-op (they buffer
    /// nothing while paused — a queued kick is simply dropped, not deferred
    /// until `resume()`). If a cycle is already running when `pause()` is
    /// called, it suspends until that cycle finishes, so the instant it
    /// returns the caller can safely mutate store state with no sync cycle
    /// in flight.
    public func pause() async {
        hostPaused = true
        guard running else { return }
        await withCheckedContinuation { continuation in
            pauseWaiters.append(continuation)
        }
    }

    /// Clears the pause set by `pause()`. Does not itself trigger a sync —
    /// callers that want one should follow with `kick`/`syncNow`.
    public func resume() {
        hostPaused = false
    }

    /// Runs one full cycle to completion (test/host entry point).
    public func syncNow(reason: SyncKickReason) async {
        guard !hostPaused else { return }
        if authPaused {
            let manual = reason == .manual || { if case .hostSpecific = reason { return true }; return false }()
            guard manual else { return }
            authPaused = false
        }
        guard !running else {
            pendingReason = pendingReason ?? reason
            return
        }
        running = true
        eventContinuation.yield(.started(reason))
        do {
            try await pullLoop()
            try await pushLoop()
            consecutiveFailures = 0
            eventContinuation.yield(.idle)
        } catch SyncTransportError.unauthorized {
            authPaused = true
            eventContinuation.yield(.authRequired)
        } catch SyncTransportError.resyncRequired {
            await performResync()
        } catch {
            consecutiveFailures += 1
            eventContinuation.yield(.failed(String(describing: error)))
            scheduleRetry()
        }
        running = false
        let waiters = pauseWaiters
        pauseWaiters = []
        for waiter in waiters { waiter.resume() }
        if hostPaused {
            // Paused while this cycle was in flight: per pause()'s contract,
            // buffer nothing — a resume() + explicit kick is required to
            // sync again, rather than resurrecting a reason queued before
            // (or during) the pause.
            pendingReason = nil
        } else if let queued = pendingReason {
            pendingReason = nil
            await syncNow(reason: queued)
        }
    }

    private func pullLoop() async throws {
        var hasMore = true
        while hasMore {
            let cursor = try await store.cursor()
            let response = try await transport.pull(cursor: cursor, limit: config.pullLimit)
            try await store.prepare(resources: response.manifest)
            let next = SyncCursor(rawValue: response.cursor)
            try await store.apply(response.changes, advancingTo: next)
            eventContinuation.yield(.pulledBatch(changes: response.changes.count, cursor: next))
            hasMore = response.hasMore
        }
    }

    private func pushLoop() async throws {
        while true {
            let ops = try await store.pendingOps(limit: config.pushBatchSize)
            guard !ops.isEmpty else { return }
            let attemptedOpIds = Set(ops.map(\.opId))
            let response = try await transport.push(SyncPushRequest(deviceId: config.deviceId, ops: ops))
            var applied = 0
            var conflicts = 0
            var rejected = 0
            var adoptions: [SyncChange] = []
            var resultsForStore: [SyncPushResult] = []
            resultsForStore.reserveCapacity(response.results.count)
            for result in response.results {
                switch result.status {
                case .applied:
                    applied += 1
                    resultsForStore.append(result)
                case .rejected:
                    rejected += 1
                    resultsForStore.append(result)
                case .conflict:
                    guard let matchingOp = ops.first(where: { $0.opId == result.opId }) else {
                        conflicts += 1
                        resultsForStore.append(result)
                        continue
                    }
                    guard let current = result.current else {
                        // p2-Minor9: a conflict with no `current` row can't
                        // be resolved — there is nothing to adopt. Treat it
                        // like a rejection (quarantine, reason preserved)
                        // instead of silently logging + dropping the op.
                        rejected += 1
                        resultsForStore.append(
                            SyncPushResult(opId: result.opId, status: .rejected, reason: result.reason)
                        )
                        continue
                    }
                    guard let version = Self.adoptedVersion(from: current) else {
                        // p2g: a non-finite/out-of-Int64-range sync_version
                        // can't be converted safely — String(Int(number))
                        // would trap. Skip adopting; the op still resolves
                        // via `complete` below (the server remains
                        // authoritative even though we can't mirror its row).
                        conflicts += 1
                        eventContinuation.yield(.failed(
                            "conflict adoption skipped for \(matchingOp.resource)/\(matchingOp.rowId): " +
                            "unrepresentable sync_version"
                        ))
                        resultsForStore.append(result)
                        continue
                    }
                    conflicts += 1
                    // LWW + delete-wins: adopt the server row locally.
                    let deleted = !(current["deleted_at"]?.isNull ?? true)
                    var data = current
                    // p2-Minor4: these are bookkeeping columns, not app
                    // data — don't leak them into the mirror row's `data`.
                    data["sync_version"] = nil
                    data["sync_stamped_at"] = nil
                    adoptions.append(SyncChange(
                        resource: matchingOp.resource,
                        id: matchingOp.rowId,
                        op: deleted ? .delete : .upsert,
                        syncVersion: version,
                        data: deleted ? nil : data
                    ))
                    eventContinuation.yield(
                        .conflictResolved(resource: matchingOp.resource, rowId: matchingOp.rowId)
                    )
                    resultsForStore.append(result)
                }
            }
            if !adoptions.isEmpty {
                try await store.apply(adoptions, advancingTo: nil)
            }
            try await store.complete(resultsForStore)
            eventContinuation.yield(.pushed(applied: applied, conflicts: conflicts, rejected: rejected))
            if response.results.isEmpty { return } // defensive: avoid spinning
            // Spin guard: if none of the ops we just attempted were resolved
            // (e.g. a misbehaving server returns results whose opIds match
            // nothing in the outbox), `complete` no-ops and the same batch
            // would be re-fetched forever. Surface it as a failure instead.
            let stillPending = try await store.pendingOps(limit: config.pushBatchSize)
            let remainingOpIds = Set(stillPending.map(\.opId))
            if attemptedOpIds.isSubset(of: remainingOpIds) {
                throw SyncEngineError.pushMadeNoProgress
            }
        }
    }

    /// Checked conversion of a conflict's `current["sync_version"]` to the
    /// string form `SyncChange.syncVersion` expects. Returns nil (skip
    /// adopting, per p2g) rather than trapping for a non-finite or
    /// out-of-Int64-range double — `Int(exactly:)` is the safe, native
    /// checked-conversion API for exactly this case.
    private static func adoptedVersion(from current: [String: JSONValue]) -> String? {
        guard let value = current["sync_version"] else { return "0" }
        guard case .number(let number) = value else { return value.stringValue ?? "0" }
        guard let intValue = Int(exactly: number) else { return nil }
        return String(intValue)
    }

    /// A resync clears the mirror and cursor but preserves the outbox
    /// (`SyncStore.resetForResync` contract). It re-pulls the full snapshot,
    /// then replays the preserved outbox under its existing opIds, exactly
    /// as it would have without the 410 (adh sync.md §4).
    private func performResync() async {
        do {
            try await store.resetForResync()
            eventContinuation.yield(.resyncPerformed)
            try await pullLoop()
            try await pushLoop()   // contract (adh sync.md §4): preserved outbox replays
                                    // with its existing opIds, exactly as without the 410
            consecutiveFailures = 0
            eventContinuation.yield(.idle)
        } catch SyncTransportError.unauthorized {
            // Same event semantics as syncNow's own unauthorized handling:
            // this is an auth failure, not a sync failure — pause and wait
            // for a manual kick rather than backing off and retrying.
            authPaused = true
            eventContinuation.yield(.authRequired)
        } catch SyncTransportError.resyncRequired {
            // A second 410 mid-resync (rare, but the server can raise the GC
            // horizon again between our reset and the re-pull) — rethrow
            // into the same recovery path rather than treating it as a
            // generic failure.
            await performResync()
        } catch {
            consecutiveFailures += 1
            eventContinuation.yield(.failed(String(describing: error)))
            scheduleRetry()
        }
    }

    private func scheduleRetry() {
        let exponent = min(consecutiveFailures, 16)
        let delay = min(config.baseBackoff * pow(2, Double(exponent - 1)), config.maxBackoff)
        retryTask?.cancel()
        retryTask = Task { [weak self] in
            try? await Task.sleep(for: .seconds(delay))
            guard !Task.isCancelled else { return }
            await self?.kick(reason: .periodic)
        }
    }
}

/// Internal engine failure modes surfaced via `SyncEvent.failed` (not part
/// of the frozen public surface).
enum SyncEngineError: Error, Sendable, Equatable {
    /// A push round-trip resolved none of the ops it attempted (e.g. the
    /// server returned results whose opIds matched nothing in the outbox).
    /// Retrying the identical batch forever would spin; surfaced as a
    /// regular failure so backoff + the normal retry path handle it.
    case pushMadeNoProgress
}

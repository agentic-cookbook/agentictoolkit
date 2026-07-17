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
    private var consecutiveFailures = 0
    private var triggerTasks: [Task<Void, Never>] = []
    private var retryTask: Task<Void, Never>?

    public nonisolated let events: AsyncStream<SyncEvent>
    private let eventContinuation: AsyncStream<SyncEvent>.Continuation

    public init(store: any SyncStore, transport: any SyncTransport, configuration: SyncEngineConfiguration) {
        self.store = store
        self.transport = transport
        self.config = configuration
        (self.events, self.eventContinuation) = AsyncStream.makeStream(of: SyncEvent.self)
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
        if running {
            pendingReason = pendingReason ?? reason
            return
        }
        await syncNow(reason: reason)
    }

    /// Runs one full cycle to completion (test/host entry point).
    public func syncNow(reason: SyncKickReason) async {
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
        if let queued = pendingReason {
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
            for result in response.results {
                switch result.status {
                case .applied:
                    applied += 1
                case .conflict:
                    conflicts += 1
                    if let current = result.current,
                       let matchingOp = ops.first(where: { $0.opId == result.opId }) {
                        // LWW + delete-wins: adopt the server row locally.
                        let deleted = !(current["deleted_at"]?.isNull ?? true)
                        let version = current["sync_version"].map { value -> String in
                            if case .number(let number) = value { return String(Int(number)) }
                            return value.stringValue ?? "0"
                        } ?? "0"
                        adoptions.append(SyncChange(
                            resource: matchingOp.resource,
                            id: matchingOp.rowId,
                            op: deleted ? .delete : .upsert,
                            syncVersion: version,
                            data: deleted ? nil : current
                        ))
                        eventContinuation.yield(
                            .conflictResolved(resource: matchingOp.resource, rowId: matchingOp.rowId)
                        )
                    }
                case .rejected:
                    rejected += 1
                }
            }
            if !adoptions.isEmpty {
                try await store.apply(adoptions, advancingTo: nil)
            }
            try await store.complete(response.results)
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

import Foundation

public struct SyncEngineConfiguration: Sendable {
    public var deviceId: String
    public var pullLimit: Int
    public var pushBatchSize: Int
    public var baseBackoff: TimeInterval
    public var maxBackoff: TimeInterval
    /// Resources this host mirrors. nil = accept the server's whole manifest
    /// (the pre-enrollment behavior). When set, the effective set is
    /// manifest ∩ hostResources and changes outside it are skipped.
    public var hostResources: [SyncResource]?

    public init(
        deviceId: String,
        pullLimit: Int = 500,
        pushBatchSize: Int = 100,
        baseBackoff: TimeInterval = 2,
        maxBackoff: TimeInterval = 3600,
        hostResources: [SyncResource]? = nil
    ) {
        self.deviceId = deviceId
        self.pullLimit = pullLimit
        self.pushBatchSize = pushBatchSize
        self.baseBackoff = baseBackoff
        self.maxBackoff = maxBackoff
        self.hostResources = hostResources
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
    /// Resumed when the in-flight cycle finishes — shared by `pause()`
    /// (waiting to safely mutate the store) and `syncNow(reason:)` (waiting
    /// to return an honest "sync happened" signal to a caller that coalesced
    /// into the running cycle instead of starting its own).
    private var cycleWaiters: [CheckedContinuation<Void, Never>] = []
    private var consecutiveFailures = 0
    /// Consecutive `resyncRequired` (410) events seen without an
    /// intervening successful cycle — see `performResync`'s bounding logic.
    private var consecutiveResyncs = 0
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
            cycleWaiters.append(continuation)
        }
    }

    /// Clears the pause set by `pause()`. Does not itself trigger a sync —
    /// callers that want one should follow with `kick`/`syncNow`.
    public func resume() {
        hostPaused = false
    }

    /// Runs one full cycle to completion (test/host entry point). If a cycle
    /// is already running, this call coalesces into it (the same as `kick`)
    /// rather than starting a second one — but unlike `kick`, it does not
    /// return immediately. It suspends until the current cycle (yours or the
    /// one you joined) finishes, then returns; a coalesced follow-up cycle
    /// may still run after that return, but this call does not wait for it.
    /// That makes `syncNow` an honest "a sync just ran" signal for callers
    /// like pull-to-refresh spinners or BG-task completion handlers. Does
    /// NOT wait while `hostPaused`/`authPaused` (non-manual) short-circuit —
    /// those keep their existing immediate-return behavior.
    public func syncNow(reason: SyncKickReason) async {
        guard !hostPaused else { return }
        if authPaused {
            let manual = reason == .manual || { if case .hostSpecific = reason { return true }; return false }()
            guard manual else { return }
            authPaused = false
        }
        guard !running else {
            pendingReason = pendingReason ?? reason
            await withCheckedContinuation { continuation in
                cycleWaiters.append(continuation)
            }
            return
        }
        running = true
        eventContinuation.yield(.started(reason))
        do {
            try await pullLoop()
            try await pushLoop()
            consecutiveFailures = 0
            consecutiveResyncs = 0
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
        let waiters = cycleWaiters
        cycleWaiters = []
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
        var consecutiveNoProgress = 0
        var reconcileResyncs = 0
        // Fix H5+H1: read the registrations once at cycle start into a local
        // snapshot and keep it current as reconcile purges (removes keys) and
        // prepare registers (sets versions). Reconcile still runs per page, but
        // it — and the prepare gate below — read this snapshot instead of
        // hitting the store on every page.
        var registered = try await store.registrations()
        // Fix H4: latch the last-emitted unregistered-manifest set for this
        // cycle so a multi-page pull over the same curated hostResources subset
        // emits `.unregisteredManifestResources` once, not once per page. nil =
        // nothing emitted yet this cycle.
        var lastUnregisteredEmitted: [String]?
        while hasMore {
            let cursor = try await store.cursor()
            let response = try await transport.pull(cursor: cursor, limit: config.pullLimit)
            let effective = effectiveResources(from: response.manifest)
            if try await reconcile(
                effective: effective,
                manifest: response.manifest,
                cursor: cursor,
                registered: &registered,
                lastUnregisteredEmitted: &lastUnregisteredEmitted
            ) {
                // Mirror was reset (appearance/schema bump on a non-fresh
                // cursor): restart the pull from a nil cursor.
                reconcileResyncs += 1
                if reconcileResyncs > Self.maxReconcileResyncsPerCycle {
                    throw SyncEngineError.manifestUnstable
                }
                hasMore = true
                consecutiveNoProgress = 0
                continue
            }
            // Fix H5+H1: prepare (a store write) only when the snapshot doesn't
            // already cover `effective` at equal versions — skip it on the
            // steady-state page where nothing enrolled, disenrolled, or bumped.
            if !Self.snapshotCovers(registered, effective) {
                try await store.prepare(resources: effective)
                for descriptor in effective { registered[descriptor.resource] = descriptor.schemaVersion }
            }
            let applicable: [SyncChange]
            if config.hostResources != nil {
                let names = Set(effective.map(\.resource))
                applicable = response.changes.filter { names.contains($0.resource) }
            } else {
                applicable = response.changes
            }
            let next = SyncCursor(rawValue: response.cursor)
            try await store.apply(applicable, advancingTo: next)
            eventContinuation.yield(.pulledBatch(changes: applicable.count, cursor: next))
            hasMore = response.hasMore
            // No-progress guard: the server's cohort stall guard legitimately
            // returns empty changes + hasMore=true + an unchanged cursor when
            // the caller's cursor is ahead of the observed xmin (a lagging
            // replica) — that is not a bug, but the client must back off
            // rather than hot-loop re-requesting the same page forever.
            // Require a couple of consecutive occurrences (not one) so a
            // single legitimate empty-but-advancing page, or a same-cursor
            // page whose changes are non-empty, never trips this.
            if response.changes.isEmpty && response.hasMore && next == cursor {
                consecutiveNoProgress += 1
                if consecutiveNoProgress >= Self.maxConsecutiveNoProgressPulls {
                    throw SyncEngineError.pullMadeNoProgress
                }
            } else {
                consecutiveNoProgress = 0
            }
        }
    }

    private static let maxReconcileResyncsPerCycle = 3

    private func effectiveResources(from manifest: [SyncResource]) -> [SyncResource] {
        guard let host = config.hostResources else { return manifest }
        let wanted = Set(host.map(\.resource))
        return manifest.filter { wanted.contains($0.resource) }
    }

    /// The registration diff for one page, split out as a pure function so it
    /// can be unit-tested directly (fix I6). Given the current registration
    /// snapshot and the page's effective manifest, classify every resource as:
    ///   - `disabled`: registered but no longer in the effective set — purge +
    ///     quarantine its unpushed edits.
    ///   - `bumped`: registered at a *different* schema_version than the
    ///     manifest now reports — purge + resync. A version CHANGE in either
    ///     direction counts (fix A2): a downgrade is as much a schema mismatch
    ///     as an upgrade, and mirror rows written under the old version can't be
    ///     trusted against the new one, so a rise OR a fall must purge + resync,
    ///     not just a rise.
    ///   - `appeared`: newly in the effective set (no prior registration) —
    ///     resync on a non-fresh cursor.
    /// Side-effect orchestration (purge/reset/emit) stays in `reconcile`.
    static func reconcilePlan(
        registered: [String: Int],
        effective: [SyncResource]
    ) -> (disabled: [String], bumped: [String], appeared: [String]) {
        let effectiveNames = Set(effective.map(\.resource))
        let disabled = registered.keys.filter { !effectiveNames.contains($0) }.sorted()
        let bumped = effective
            .filter { resource in registered[resource.resource].map { $0 != resource.schemaVersion } ?? false }
            .map(\.resource).sorted()
        let appeared = effective.map(\.resource)
            .filter { registered[$0] == nil }.sorted()
            // G2 (fix): provably dead today — `appeared` (registered[$0] == nil)
            // and `bumped` (registered[$0] != nil) are computed against the same
            // `registered` snapshot, so they are disjoint and this filter removes
            // nothing. Kept deliberately: it becomes load-bearing the moment
            // `appeared` is ever recomputed against a post-purge registrations
            // read — a bumped resource whose purge removed its registration would
            // resurface as "appeared" and be double-counted. Cheap insurance
            // against that future refactor; do not delete.
            .filter { !bumped.contains($0) }
        return (disabled: disabled, bumped: bumped, appeared: appeared)
    }

    /// True when `registered` already covers every resource in `effective` at
    /// the exact same schema_version — the steady-state page where nothing
    /// enrolled, disenrolled, or bumped, so `store.prepare` would be a no-op
    /// write and is skipped (fix H5+H1).
    private static func snapshotCovers(_ registered: [String: Int], _ effective: [SyncResource]) -> Bool {
        effective.allSatisfy { registered[$0.resource] == $0.schemaVersion }
    }

    /// Enrollment transitions (recipe: offline-sync-client). Diffs the
    /// effective manifest against the `registered` snapshot BEFORE prepare, and
    /// keeps that snapshot current as it purges (so the caller's per-cycle
    /// snapshot never needs a fresh `registrations()` read). Returns true when
    /// the mirror was reset and the pull must restart.
    private func reconcile(
        effective: [SyncResource],
        manifest: [SyncResource],
        cursor: SyncCursor?,
        registered: inout [String: Int],
        lastUnregisteredEmitted: inout [String]?
    ) async throws -> Bool {
        let effectiveNames = Set(effective.map(\.resource))

        if config.hostResources != nil {
            let unregistered = manifest.map(\.resource)
                .filter { !effectiveNames.contains($0) }.sorted()
            // Fix H4: emit at most once per distinct set per cycle — only when
            // non-empty AND it differs from the last set emitted this cycle, so
            // a multi-page pull over an unchanged subset yields one event.
            if !unregistered.isEmpty, unregistered != lastUnregisteredEmitted {
                eventContinuation.yield(.unregisteredManifestResources(unregistered))
                lastUnregisteredEmitted = unregistered
            }
        }

        let plan = Self.reconcilePlan(registered: registered, effective: effective)

        if !plan.disabled.isEmpty {
            try await store.purgeResources(plan.disabled)
            for name in plan.disabled { registered[name] = nil }
            eventContinuation.yield(.resourcesDisabled(plan.disabled))
        }

        if !plan.bumped.isEmpty {
            try await store.purgeResources(plan.bumped)
            for name in plan.bumped { registered[name] = nil }
            eventContinuation.yield(.resourcesSchemaBumped(plan.bumped))
        }

        // Fresh cursor: the initial pull covers everything — no gap, no resync.
        guard cursor != nil, !(plan.appeared.isEmpty && plan.bumped.isEmpty) else { return false }
        try await store.resetForResync()
        if !plan.appeared.isEmpty { eventContinuation.yield(.resourcesEnabled(plan.appeared)) }
        eventContinuation.yield(.resyncPerformed)
        return true
    }

    /// Bound on consecutive empty+hasMore+unchanged-cursor pull responses
    /// before `pullLoop` gives up and surfaces `.pullMadeNoProgress` instead
    /// of hot-looping against a stalled/lagging server.
    private static let maxConsecutiveNoProgressPulls = 2

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
                        // A3 (fix): the conflict's current.sync_version can't
                        // become a numeric version — either a non-numeric string
                        // (which the old `adoptedVersion` passed through verbatim,
                        // so `store.apply` threw before `complete()` ran and the
                        // op re-pushed every cycle forever) or a
                        // non-finite/out-of-Int64-range number. Either way the
                        // server row is unadoptable, so route the op to the
                        // terminal quarantine outcome — the same path as an
                        // explicit `.rejected` — rather than re-attempting it. A
                        // quarantined op is never retried under its original opId;
                        // a fixed retry must re-`stage` for a fresh one. This
                        // unifies what used to be two behaviors (non-numeric
                        // string wedged; unrepresentable number "resolved as
                        // conflict") into one: unadoptable ⇒ quarantine.
                        rejected += 1
                        resultsForStore.append(
                            SyncPushResult(opId: result.opId, status: .rejected, reason: result.reason)
                        )
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
            // Spin guard (fix S2): if none of the ops we just attempted were
            // resolved, `complete` no-ops and the same batch would be re-fetched
            // forever. This covers a misbehaving server that returns results whose
            // opIds match nothing in the outbox AND one that answers a non-empty
            // pushed batch with an empty `results` array — the latter used to be
            // short-circuited by an `if response.results.isEmpty { return }` here,
            // which reported `.idle` and silently stopped draining instead of
            // backing off. Both are "no progress"; surface them as a failure so
            // the normal backoff + retry path handles them.
            let stillPending = try await store.pendingOps(limit: config.pushBatchSize)
            let remainingOpIds = Set(stillPending.map(\.opId))
            if attemptedOpIds.isSubset(of: remainingOpIds) {
                throw SyncEngineError.pushMadeNoProgress
            }
        }
    }

    /// Checked conversion of a conflict's `current["sync_version"]` to the
    /// string form `SyncChange.syncVersion` expects (`/^\d+$/`). Returns nil —
    /// routing the op to quarantine (fix A3) — for any value that can't yield a
    /// numeric version, so a malformed `current` is never handed to
    /// `store.apply` (which would throw and wedge the push loop):
    ///   - a non-finite or out-of-Int64-range `.number` (`Int(exactly:)` fails);
    ///   - a `.string` that isn't a base-10 integer (the old code returned such
    ///     a string verbatim, which then wedged `apply`);
    ///   - any other JSON type (`.bool`/`.array`/`.object`).
    /// A missing `sync_version` key still means "version 0" — an absent version
    /// is the well-defined pre-first-write state, not a malformed one.
    private static func adoptedVersion(from current: [String: JSONValue]) -> String? {
        guard let value = current["sync_version"] else { return "0" }
        switch value {
        case .number(let number):
            guard let intValue = Int(exactly: number) else { return nil }
            return String(intValue)
        case .string(let string):
            guard Int(string) != nil else { return nil }
            return string
        default:
            return nil
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
            consecutiveResyncs = 0
            eventContinuation.yield(.idle)
        } catch SyncTransportError.unauthorized {
            // Same event semantics as syncNow's own unauthorized handling:
            // this is an auth failure, not a sync failure — pause and wait
            // for a manual kick rather than backing off and retrying.
            authPaused = true
            eventContinuation.yield(.authRequired)
        } catch SyncTransportError.resyncRequired {
            // A second 410 mid-resync (rare, but the server can raise the GC
            // horizon again between our reset and the re-pull) is worth one
            // immediate nested retry. But recursing unconditionally here
            // hot-loops reset+pull forever against a server that keeps
            // returning 410 — bound it: `consecutiveResyncs` persists across
            // performResync calls (reset only by a fully successful cycle),
            // so only the very first 410-after-a-410 gets the immediate
            // retry; every one after that routes through the same
            // scheduleRetry/backoff path as any other failure, giving the
            // server (or our clock) time to actually catch up.
            consecutiveResyncs += 1
            if consecutiveResyncs <= 1 {
                await performResync()
            } else {
                consecutiveFailures += 1
                eventContinuation.yield(.failed("repeated resync_required from server; backing off"))
                scheduleRetry()
            }
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
    /// `pullLoop` saw `maxConsecutiveNoProgressPulls` consecutive responses
    /// with empty changes, `hasMore == true`, and a cursor unchanged from the
    /// one just requested — belt-and-braces against a buggy/lagging server
    /// that never advances; the normal backoff + retry path handles it from
    /// here rather than the engine hot-looping the same request forever.
    case pullMadeNoProgress
    /// `pullLoop` performed more than `maxReconcileResyncsPerCycle` mirror
    /// resets in a single cycle — the server manifest keeps flapping a
    /// resource in and out of the effective set (or its schema_version keeps
    /// rising) faster than a resync can settle. Surfaced as a regular failure
    /// so backoff + the normal retry path handle it rather than the engine
    /// hot-looping reset+re-pull forever.
    case manifestUnstable
}

extension SyncEngineError: CustomStringConvertible {
    /// `syncNow`'s catch-all reports failures via `String(describing: error)`
    /// (`SyncEvent.failed`'s payload is a plain `String`) — this conformance
    /// is what makes that text a clear, human-readable reason instead of the
    /// bare enum case name.
    var description: String {
        switch self {
        case .pushMadeNoProgress: return "push made no progress"
        case .pullMadeNoProgress: return "pull made no progress"
        case .manifestUnstable: return "manifest unstable"
        }
    }
}

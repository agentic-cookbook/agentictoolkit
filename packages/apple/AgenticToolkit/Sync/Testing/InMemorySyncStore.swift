import Foundation

/// Reference SyncStore for tests and previews (the toolkit convention:
/// fakes ship in the framework — see Core/Chat/MockChatSession.swift).
public actor InMemorySyncStore: SyncStore {
    public struct Row: Sendable, Equatable {
        public var syncVersion: String
        public var deleted: Bool
        public var data: [String: JSONValue]

        public init(syncVersion: String, deleted: Bool, data: [String: JSONValue]) {
            self.syncVersion = syncVersion
            self.deleted = deleted
            self.data = data
        }
    }

    /// Mirrors GRDBSyncStore's outbox status: `inflight` ops were handed out
    /// by a `pendingOps` call whose push never completed (still in flight, or
    /// the process crashed before `complete` landed) — they stay eligible on
    /// the next `pendingOps` call so a retry replays the same opId. Rejected
    /// ops are removed from `outbox` entirely and tracked in `quarantined`.
    private enum OutboxStatus: Sendable {
        case pending
        case inflight
    }

    private struct OutboxEntry: Sendable {
        var pushOp: SyncPushOp
        var status: OutboxStatus
    }

    /// A registered resource's schema_version plus its mirror rows, held as one
    /// value so the two can never disagree about whether the resource is
    /// registered — key presence in `resourceStates` IS the registration truth
    /// that `stage`/`apply`/`rowCount` consult (previously a schema-version dict
    /// and a rows dict kept hand-locked in step).
    private struct ResourceState: Sendable {
        var schemaVersion: Int
        var rows: [String: Row]
    }
    /// resource -> its registered schema_version + mirror rows, upserted by
    /// `prepare` and removed by `purgeResources`; `registrations()` projects
    /// out the schema versions.
    private var resourceStates: [String: ResourceState] = [:]
    private var storedCursor: SyncCursor?
    private var outbox: [OutboxEntry] = []
    public private(set) var conflictLog: [(opId: String, reason: String?)] = []
    /// Ops the server rejected — or whose resource was purged by an
    /// enrollment-disable `purgeResources`. These are NOT retried under their
    /// original opId — the server ledgers push results immutably per opId, so
    /// a fixed retry must go through `stage(_:)` again to mint a fresh one.
    public private(set) var quarantined: [SyncPushOp] = []
    /// Resources this host may pull but never push. `stage(_:)` refuses them
    /// up front with `SyncStoreFailure.pullOnlyResource`.
    private let pullOnlyResources: Set<String>

    public init(pullOnlyResources: Set<String> = []) {
        self.pullOnlyResources = pullOnlyResources
    }

    public func prepare(resources: [SyncResource]) async throws {
        for descriptor in resources {
            if resourceStates[descriptor.resource] != nil {
                resourceStates[descriptor.resource]!.schemaVersion = descriptor.schemaVersion
            } else {
                resourceStates[descriptor.resource] = ResourceState(
                    schemaVersion: descriptor.schemaVersion, rows: [:]
                )
            }
        }
    }

    public func cursor() async throws -> SyncCursor? { storedCursor }

    public func apply(_ batch: [SyncChange], advancingTo cursor: SyncCursor?) async throws {
        // Atomic (arch doc §"apply is all-or-nothing", parity with
        // GRDBSyncStore.apply's single write transaction): stage every change
        // into a local copy and only commit it — and advance the cursor — once
        // the whole batch validates. A mid-batch throw (unknown resource,
        // unparseable syncVersion) must leave the mirror rows AND the cursor
        // exactly as they were, never a half-applied batch.
        var staged = resourceStates
        for change in batch {
            guard staged[change.resource] != nil else {
                throw SyncStoreFailure.unknownResource(change.resource)
            }
            // Parity with GRDBSyncStore.apply: even though this fake keeps
            // syncVersion as a String, an unparseable one must fail the same
            // way the real store does rather than silently accepting a value
            // that violates the wire contract's `/^\d+$/` guarantee.
            guard Int(change.syncVersion) != nil else {
                throw SyncStoreFailure.invalidChange("unparseable syncVersion: \(change.syncVersion)")
            }
            staged[change.resource]!.rows[change.id] = Row(
                syncVersion: change.syncVersion,
                deleted: change.op == .delete,
                data: change.data ?? [:]
            )
        }
        resourceStates = staged
        if let cursor { storedCursor = cursor }
    }

    /// Local mutation: optimistic mirror write + outbox op. Coalesces into an
    /// existing `pending` op for this (resource, rowId) in place — same
    /// opId, same original baseVersion — mirroring GRDBSyncStore.stage so the
    /// fakes don't lie about the coalescing behavior the real store provides
    /// (sync fix-wave item p2a).
    ///
    /// The resource must already be registered via `prepare(resources:)` —
    /// staging offline for an unregistered resource throws
    /// `SyncStoreFailure.unknownResource` rather than silently creating an
    /// empty table for it, matching GRDBSyncStore.stage (sync fix-wave item
    /// p2o).
    public func stage(_ mutation: LocalMutation) async throws {
        guard !pullOnlyResources.contains(mutation.resource) else {
            throw SyncStoreFailure.pullOnlyResource(mutation.resource)
        }
        guard resourceStates[mutation.resource] != nil else {
            throw SyncStoreFailure.unknownResource(mutation.resource)
        }
        let base = resourceStates[mutation.resource]?.rows[mutation.rowId]?.syncVersion
        resourceStates[mutation.resource]!.rows[mutation.rowId] = Row(
            syncVersion: base ?? "0",
            deleted: mutation.type == .delete,
            data: mutation.data ?? [:]
        )
        if let index = outbox.firstIndex(where: {
            $0.status == .pending && $0.pushOp.resource == mutation.resource && $0.pushOp.rowId == mutation.rowId
        }) {
            let existingOp = outbox[index].pushOp
            let mergedData: [String: JSONValue]?
            switch mutation.type {
            case .upsert:
                mergedData = (existingOp.data ?? [:]).merging(mutation.data ?? [:]) { _, new in new }
            case .delete:
                mergedData = nil
            }
            outbox[index].pushOp = SyncPushOp(
                opId: existingOp.opId,
                resource: existingOp.resource,
                rowId: existingOp.rowId,
                type: mutation.type,
                baseVersion: existingOp.baseVersion,
                data: mergedData
            )
        } else {
            outbox.append(OutboxEntry(
                pushOp: SyncPushOp(
                    opId: SyncID.uuidV7(),
                    resource: mutation.resource,
                    rowId: mutation.rowId,
                    type: mutation.type,
                    baseVersion: base,
                    data: mutation.data
                ),
                status: .pending
            ))
        }
    }

    /// Returns up to `limit` ops in insertion order (FIFO), marking every
    /// returned op `inflight`. Already-`inflight` ops are returned again —
    /// see `OutboxStatus`.
    public func pendingOps(limit: Int) async throws -> [SyncPushOp] {
        let indices = outbox.indices.filter { outbox[$0].status == .pending || outbox[$0].status == .inflight }
            .prefix(limit)
        for index in indices { outbox[index].status = .inflight }
        return indices.map { outbox[$0].pushOp }
    }

    public func complete(_ results: [SyncPushResult]) async throws {
        for result in results {
            guard let idx = outbox.firstIndex(where: { $0.pushOp.opId == result.opId }) else { continue }
            switch result.status {
            case .applied:
                let completedOp = outbox[idx].pushOp
                if let newVersion = result.newVersion,
                   Int(newVersion) != nil, // skip-if-unparseable: parity with GRDBSyncStore.complete
                   resourceStates[completedOp.resource]?.rows[completedOp.rowId] != nil {
                    // Adopt the server's post-apply sync_version onto the mirror row
                    // before dropping the outbox entry — mirrors GRDBSyncStore.complete
                    // so the fakes don't lie about the adoption behavior the real store
                    // provides (adh sync.md §3). An unparseable newVersion is skipped
                    // rather than adopted (or thrown) — same rationale as GRDBSyncStore:
                    // this is completion bookkeeping, not a place to abort and wedge the
                    // outbox row.
                    resourceStates[completedOp.resource]!.rows[completedOp.rowId]!.syncVersion = newVersion
                }
                outbox.remove(at: idx)
            case .conflict:
                conflictLog.append((result.opId, result.reason))
                outbox.remove(at: idx)
            case .rejected:
                quarantined.append(outbox.remove(at: idx).pushOp)
            }
        }
    }

    public func resetForResync() async throws {
        // Clear every registered resource's mirror rows but keep its
        // registration (schema_version) — resync re-fetches data, not enrollment.
        resourceStates = resourceStates.mapValues {
            ResourceState(schemaVersion: $0.schemaVersion, rows: [:])
        }
        storedCursor = nil
    }

    public func registrations() async throws -> [String: Int] {
        resourceStates.mapValues(\.schemaVersion)
    }

    /// Enrollment-disable transition (sync fix-wave): drop the purged
    /// resources' mirror rows and registrations, and move any of their
    /// outbox ops (all `pending`/`inflight` — rejected ops already live in
    /// `quarantined`) into `quarantined` so they are never pushed under
    /// their original opId. The cursor is deliberately left untouched.
    public func purgeResources(_ resources: [String]) async throws {
        let purged = Set(resources)
        guard !purged.isEmpty else { return }
        for resource in purged {
            // Silent no-op for a resource that was never registered — twin of
            // GRDBSyncStore.purgeResources (which skips its mirror DELETE for
            // unregistered resources rather than throwing "no such table").
            resourceStates[resource] = nil
        }
        var survivors: [OutboxEntry] = []
        survivors.reserveCapacity(outbox.count)
        for entry in outbox {
            if purged.contains(entry.pushOp.resource) {
                quarantined.append(entry.pushOp)
            } else {
                survivors.append(entry)
            }
        }
        outbox = survivors
    }

    // Test conveniences
    /// Live (non-deleted) row count for a registered resource. Throws
    /// `SyncStoreFailure.unknownResource` for a resource that was never
    /// registered — or was deregistered by `purgeResources` — rather than
    /// reporting a misleading zero.
    public func rowCount(resource: String) throws -> Int {
        guard let state = resourceStates[resource] else {
            throw SyncStoreFailure.unknownResource(resource)
        }
        return state.rows.values.filter { !$0.deleted }.count
    }
    public func row(resource: String, id: String) -> Row? { resourceStates[resource]?.rows[id] }
    /// The current `pending` op's id for (resource, rowId), if any. Unlike
    /// `pendingOps`, this does NOT mark the op `inflight` — for tests that
    /// need to capture an opId before a later `stage()` call that should
    /// still coalesce into it.
    public func pendingOpId(resource: String, rowId: String) -> String? {
        outbox.first {
            $0.status == .pending && $0.pushOp.resource == resource && $0.pushOp.rowId == rowId
        }?.pushOp.opId
    }
}

public enum SyncStoreFailure: Error, Sendable, Equatable {
    case unknownResource(String)
    /// A pulled `SyncChange`/outbox row carried a value this store can't
    /// safely interpret — e.g. a `syncVersion` that isn't the `/^\d+$/` the
    /// wire contract guarantees, or (GRDBSyncStore only) a corrupt outbox
    /// `type` column. Additive case: hosts only `catch is SyncStoreFailure`,
    /// never switch exhaustively over it (confirmed by grepping the two
    /// host repos), so this doesn't break existing exhaustive handling.
    case invalidChange(String)
    /// `stage(_:)` was called for a resource enrolled pull-only on this host
    /// (in the store's `pullOnlyResources`): the host may mirror pulled rows
    /// for it but must never originate a local mutation to push.
    case pullOnlyResource(String)
}

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

    private var resources: [SyncResource] = []
    private var tables: [String: [String: Row]] = [:]
    private var storedCursor: SyncCursor?
    private var outbox: [OutboxEntry] = []
    public private(set) var conflictLog: [(opId: String, reason: String?)] = []
    /// Ops the server rejected. These are NOT retried under their original
    /// opId — the server ledgers push results immutably per opId, so a
    /// fixed retry must go through `stage(_:)` again to mint a fresh one.
    public private(set) var quarantined: [SyncPushOp] = []

    public init() {}

    public func prepare(resources: [SyncResource]) async throws {
        self.resources = resources
        for descriptor in resources where tables[descriptor.resource] == nil {
            tables[descriptor.resource] = [:]
        }
    }

    public func cursor() async throws -> SyncCursor? { storedCursor }

    public func apply(_ batch: [SyncChange], advancingTo cursor: SyncCursor?) async throws {
        for change in batch {
            guard tables[change.resource] != nil else {
                throw SyncStoreFailure.unknownResource(change.resource)
            }
            // Parity with GRDBSyncStore.apply: even though this fake keeps
            // syncVersion as a String, an unparseable one must fail the same
            // way the real store does rather than silently accepting a value
            // that violates the wire contract's `/^\d+$/` guarantee.
            guard Int(change.syncVersion) != nil else {
                throw SyncStoreFailure.invalidChange("unparseable syncVersion: \(change.syncVersion)")
            }
            tables[change.resource]![change.id] = Row(
                syncVersion: change.syncVersion,
                deleted: change.op == .delete,
                data: change.data ?? [:]
            )
        }
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
        guard tables[mutation.resource] != nil else {
            throw SyncStoreFailure.unknownResource(mutation.resource)
        }
        let base = tables[mutation.resource]?[mutation.rowId]?.syncVersion
        tables[mutation.resource]![mutation.rowId] = Row(
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
                if let newVersion = result.newVersion, tables[completedOp.resource]?[completedOp.rowId] != nil {
                    // Adopt the server's post-apply sync_version onto the mirror row
                    // before dropping the outbox entry — mirrors GRDBSyncStore.complete
                    // so the fakes don't lie about the adoption behavior the real store
                    // provides (adh sync.md §3).
                    tables[completedOp.resource]![completedOp.rowId]!.syncVersion = newVersion
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
        tables = tables.mapValues { _ in [:] }
        storedCursor = nil
    }

    // Test conveniences
    public func rowCount(resource: String) throws -> Int {
        (tables[resource] ?? [:]).values.filter { !$0.deleted }.count
    }
    public func row(resource: String, id: String) -> Row? { tables[resource]?[id] }
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
}

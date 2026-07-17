import Foundation

/// Reference SyncStore for tests and previews (the toolkit convention:
/// fakes ship in the framework — see Core/Chat/MockChatSession.swift).
public actor InMemorySyncStore: SyncStore {
    public struct Row: Sendable, Equatable {
        public var syncVersion: String
        public var deleted: Bool
        public var data: [String: JSONValue]
    }

    private var resources: [SyncResource] = []
    private var tables: [String: [String: Row]] = [:]
    private var storedCursor: SyncCursor?
    private var outbox: [SyncPushOp] = []
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
            tables[change.resource]![change.id] = Row(
                syncVersion: change.syncVersion,
                deleted: change.op == .delete,
                data: change.data ?? [:]
            )
        }
        if let cursor { storedCursor = cursor }
    }

    public func stage(_ mutation: LocalMutation) async throws {
        let base = tables[mutation.resource]?[mutation.rowId]?.syncVersion
        tables[mutation.resource, default: [:]][mutation.rowId] = Row(
            syncVersion: base ?? "0",
            deleted: mutation.type == .delete,
            data: mutation.data ?? [:]
        )
        outbox.append(SyncPushOp(
            opId: SyncID.uuidV7(),
            resource: mutation.resource,
            rowId: mutation.rowId,
            type: mutation.type,
            baseVersion: base,
            data: mutation.data
        ))
    }

    public func pendingOps(limit: Int) async throws -> [SyncPushOp] {
        Array(outbox.prefix(limit))
    }

    public func complete(_ results: [SyncPushResult]) async throws {
        for result in results {
            guard let idx = outbox.firstIndex(where: { $0.opId == result.opId }) else { continue }
            switch result.status {
            case .applied:
                outbox.remove(at: idx)
            case .conflict:
                conflictLog.append((result.opId, result.reason))
                outbox.remove(at: idx)
            case .rejected:
                quarantined.append(outbox.remove(at: idx))
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
}

public enum SyncStoreFailure: Error, Sendable, Equatable {
    case unknownResource(String)
}

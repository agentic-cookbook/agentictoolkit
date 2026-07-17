import Foundation

/// The engine's (Task 4) view of local persistence: mirror rows + outbox.
/// Implementations must make `stage` and `apply` atomic with the outbox
/// mutations they imply — the engine relies on that to stay crash-safe.
public protocol SyncStore: Sendable {
    /// Registers `resources`, creating any mirror storage they need.
    /// Idempotent — safe to call repeatedly (schema versions upsert).
    /// Hosts MUST call this — via a static manifest, or by letting the
    /// first successful pull populate it — before ever calling `stage(_:)`
    /// for a resource. Staging offline ahead of that throws
    /// `SyncStoreFailure.unknownResource`; it never silently invents
    /// storage for a resource nothing has registered (sync fix-wave item
    /// p2o).
    func prepare(resources: [SyncResource]) async throws
    func cursor() async throws -> SyncCursor?
    /// Applies a pulled batch atomically; a nil cursor applies without
    /// advancing (used for conflict resolutions).
    func apply(_ batch: [SyncChange], advancingTo cursor: SyncCursor?) async throws
    /// Local mutation: optimistic row write + outbox op, atomic. The
    /// resource must already be registered via `prepare(resources:)` — see
    /// that method's doc comment. Implementations throw
    /// `SyncStoreFailure.unknownResource` for a resource that isn't.
    func stage(_ mutation: LocalMutation) async throws
    func pendingOps(limit: Int) async throws -> [SyncPushOp]
    /// Resolves outbox ops by opId. The server ledgers push results
    /// immutably per opId, so a quarantined/rejected op must never be
    /// retried under the same opId — a manual retry after fixing the cause
    /// mints a new opId via a fresh `stage(_:)` call.
    func complete(_ results: [SyncPushResult]) async throws
    /// Resync: clears mirror rows + cursor; PRESERVES the outbox. Never
    /// deletes the database file.
    func resetForResync() async throws
}

public protocol SyncTransport: Sendable {
    func pull(cursor: SyncCursor?, limit: Int) async throws -> SyncPullResponse
    func push(_ request: SyncPushRequest) async throws -> SyncPushResponse
}

public enum SyncTransportError: Error, Sendable, Equatable {
    case unauthorized                 // HTTP 401 → engine pauses, emits .authRequired
    case resyncRequired               // HTTP 410 → engine resets mirror + full re-pull
    case transport(String)            // network/5xx → retry with backoff
    case invalidResponse(statusCode: Int)
}

public protocol SyncTriggerSource: Sendable {
    var kicks: AsyncStream<SyncKickReason> { get }
}

public struct LocalMutation: Sendable, Equatable {
    public let resource: String
    public let rowId: String
    public let type: SyncChangeOp
    public let data: [String: JSONValue]?
    public init(resource: String, rowId: String, type: SyncChangeOp, data: [String: JSONValue]? = nil) {
        self.resource = resource
        self.rowId = rowId
        self.type = type
        self.data = data
    }
}

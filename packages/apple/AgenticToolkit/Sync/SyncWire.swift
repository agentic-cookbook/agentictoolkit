import Foundation

/// Wire types for /sync/pull + /sync/push. The authoritative shapes live in
/// the backend's src/sync/wire.ts; the vendored fixtures in this repo's tests
/// are the cross-language contract — do not edit them locally.

public struct SyncCursor: Codable, Sendable, Equatable, Hashable {
    public let rawValue: String
    public init(rawValue: String) { self.rawValue = rawValue }
}

public struct SyncResource: Codable, Sendable, Equatable, Hashable {
    public let resource: String
    public let schemaVersion: Int
    public init(resource: String, schemaVersion: Int) {
        self.resource = resource
        self.schemaVersion = schemaVersion
    }
}

public enum SyncChangeOp: String, Codable, Sendable {
    case upsert
    case delete
}

public struct SyncChange: Codable, Sendable, Equatable {
    public let resource: String
    public let id: String
    // swiftlint:disable:next identifier_name
    public let op: SyncChangeOp
    public let syncVersion: String
    public let data: [String: JSONValue]?
    public init(
        resource: String,
        id: String,
        // swiftlint:disable:next identifier_name
        op: SyncChangeOp,
        syncVersion: String,
        data: [String: JSONValue]? = nil
    ) {
        self.resource = resource
        self.id = id
        self.op = op
        self.syncVersion = syncVersion
        self.data = data
    }
}

public struct SyncPullResponse: Codable, Sendable, Equatable {
    public let manifest: [SyncResource]
    public let changes: [SyncChange]
    public let cursor: String
    public let hasMore: Bool
    public init(manifest: [SyncResource], changes: [SyncChange], cursor: String, hasMore: Bool) {
        self.manifest = manifest
        self.changes = changes
        self.cursor = cursor
        self.hasMore = hasMore
    }
}

public struct SyncPushOp: Codable, Sendable, Equatable {
    public let opId: String
    public let resource: String
    public let rowId: String
    public let type: SyncChangeOp
    public let baseVersion: String?
    public let data: [String: JSONValue]?
    public init(
        opId: String,
        resource: String,
        rowId: String,
        type: SyncChangeOp,
        baseVersion: String? = nil,
        data: [String: JSONValue]? = nil
    ) {
        self.opId = opId
        self.resource = resource
        self.rowId = rowId
        self.type = type
        self.baseVersion = baseVersion
        self.data = data
    }
}

public struct SyncPushRequest: Codable, Sendable, Equatable {
    public let deviceId: String
    public let ops: [SyncPushOp]
    public init(deviceId: String, ops: [SyncPushOp]) {
        self.deviceId = deviceId
        self.ops = ops
    }
}

public enum SyncPushStatus: String, Codable, Sendable {
    case applied
    case conflict
    case rejected
}

public struct SyncPushResult: Codable, Sendable, Equatable {
    public let opId: String
    public let status: SyncPushStatus
    public let reason: String?
    public let current: [String: JSONValue]?
    // Post-apply sync_version, populated ONLY on `applied` results that actually wrote a
    // row (an idempotent no-op delete of a nonexistent/already-tombstoned row has no row
    // to report). Lets the client adopt it as the row's new baseVersion immediately,
    // closing the race where a local edit gets staged again while a push for the same
    // row is still in flight (see adh sync.md §3). Optional so replayed (ledgered)
    // results from before this field existed still decode.
    public let newVersion: String?
    public init(
        opId: String,
        status: SyncPushStatus,
        reason: String? = nil,
        current: [String: JSONValue]? = nil,
        newVersion: String? = nil
    ) {
        self.opId = opId
        self.status = status
        self.reason = reason
        self.current = current
        self.newVersion = newVersion
    }
}

public struct SyncPushResponse: Codable, Sendable, Equatable {
    public let results: [SyncPushResult]
    public let watermark: String
    public init(results: [SyncPushResult], watermark: String) {
        self.results = results
        self.watermark = watermark
    }
}

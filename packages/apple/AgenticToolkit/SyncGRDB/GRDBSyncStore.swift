import Foundation
import GRDB
import AgenticToolkitDatabase
import AgenticToolkitSync

/// Snapshot of local sync bookkeeping, consumed by hosts (e.g. Plan 4's
/// `/adhd/sync/status` daemon endpoint).
public struct GRDBSyncStoreStatus: Codable, Sendable {
    public let cursor: String?
    public let outboxDepth: Int
    public let quarantinedDepth: Int
    public let conflictCount: Int
}

/// `SyncStore` on `BoundedDatabase` (WAL pool): JSON-payload mirror tables, an
/// outbox, and a conflicts audit. The mirror is fed only by apply()/stage();
/// it is NEVER deleted as a recovery path (resetForResync truncates tables,
/// preserving the outbox and the file).
public final class GRDBSyncStore: SyncStore, @unchecked Sendable {

    private let boundedDatabase: BoundedDatabase
    private let queue = DispatchQueue(label: "GRDBSyncStore")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(database: BoundedDatabase) {
        self.boundedDatabase = database
    }

    public var database: BoundedDatabase { boundedDatabase }

    public static func mirrorTableName(for resource: String) -> String {
        resource.replacingOccurrences(of: ".", with: "_")
    }

    private func onQueue<T: Sendable>(_ body: @escaping @Sendable () throws -> T) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                continuation.resume(with: Result { try body() })
            }
        }
    }

    // MARK: - SyncStore

    public func prepare(resources: [SyncResource]) async throws {
        let boundedDatabase = self.boundedDatabase
        try await onQueue {
            try boundedDatabase.write { conn in
                try conn.execute(sql: """
                    CREATE TABLE IF NOT EXISTS _sync_state (id INTEGER PRIMARY KEY CHECK (id = 1), cursor TEXT);
                    CREATE TABLE IF NOT EXISTS _sync_resources (
                        resource TEXT PRIMARY KEY, schema_version INTEGER NOT NULL);
                    CREATE TABLE IF NOT EXISTS _sync_outbox (
                        op_id TEXT PRIMARY KEY, resource TEXT NOT NULL, row_id TEXT NOT NULL,
                        type TEXT NOT NULL, base_version TEXT, payload TEXT,
                        status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
                        created_at TEXT NOT NULL);
                    CREATE TABLE IF NOT EXISTS _sync_conflicts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT, resource TEXT,
                        row_id TEXT, reason TEXT, resolved_at TEXT NOT NULL);
                    """)
                for resource in resources {
                    let table = Self.mirrorTableName(for: resource.resource)
                    try conn.execute(sql: """
                        CREATE TABLE IF NOT EXISTS "\(table)" (
                            id TEXT PRIMARY KEY NOT NULL,
                            sync_version INTEGER NOT NULL DEFAULT 0,
                            deleted_at TEXT,
                            data TEXT NOT NULL DEFAULT '{}');
                        """)
                    try conn.execute(
                        sql: """
                            INSERT INTO _sync_resources (resource, schema_version) VALUES (?, ?)
                            ON CONFLICT(resource) DO UPDATE SET schema_version = excluded.schema_version
                            """,
                        arguments: [resource.resource, resource.schemaVersion]
                    )
                }
            }
        }
    }

    public func cursor() async throws -> SyncCursor? {
        let boundedDatabase = self.boundedDatabase
        return try await onQueue {
            try boundedDatabase.read { conn in
                try String.fetchOne(conn, sql: "SELECT cursor FROM _sync_state WHERE id = 1")
            }.map(SyncCursor.init(rawValue:))
        }
    }

    public func apply(_ batch: [SyncChange], advancingTo cursor: SyncCursor?) async throws {
        let boundedDatabase = self.boundedDatabase
        let encoder = self.encoder
        try await onQueue {
            try boundedDatabase.write { conn in
                for change in batch {
                    let table = Self.mirrorTableName(for: change.resource)
                    let isKnown = try Bool.fetchOne(
                        conn, sql: "SELECT EXISTS(SELECT 1 FROM _sync_resources WHERE resource = ?)",
                        arguments: [change.resource]
                    ) ?? false
                    guard isKnown else {
                        throw SyncStoreFailure.unknownResource(change.resource)
                    }
                    let version = Int(change.syncVersion) ?? 0
                    if change.op == .delete {
                        try conn.execute(
                            sql: """
                                INSERT INTO "\(table)" (id, sync_version, deleted_at, data)
                                VALUES (?, ?, datetime('now'), '{}')
                                ON CONFLICT(id) DO UPDATE SET
                                    sync_version = excluded.sync_version, deleted_at = excluded.deleted_at, data = '{}'
                                """,
                            arguments: [change.id, version]
                        )
                    } else {
                        let payload = String(data: try encoder.encode(change.data ?? [:]), encoding: .utf8) ?? "{}"
                        try conn.execute(
                            sql: """
                                INSERT INTO "\(table)" (id, sync_version, deleted_at, data) VALUES (?, ?, NULL, ?)
                                ON CONFLICT(id) DO UPDATE SET
                                    sync_version = excluded.sync_version, deleted_at = NULL, data = excluded.data
                                """,
                            arguments: [change.id, version, payload]
                        )
                    }
                }
                if let cursor {
                    try conn.execute(
                        sql: """
                            INSERT INTO _sync_state (id, cursor) VALUES (1, ?)
                            ON CONFLICT(id) DO UPDATE SET cursor = excluded.cursor
                            """,
                        arguments: [cursor.rawValue]
                    )
                }
            }
        }
    }

    public func stage(_ mutation: LocalMutation) async throws {
        let boundedDatabase = self.boundedDatabase
        let encoder = self.encoder
        try await onQueue {
            try boundedDatabase.write { conn in
                let table = Self.mirrorTableName(for: mutation.resource)
                let base = try Int.fetchOne(
                    conn, sql: "SELECT sync_version FROM \"\(table)\" WHERE id = ?", arguments: [mutation.rowId]
                )
                if mutation.type == .delete {
                    try conn.execute(
                        sql: "UPDATE \"\(table)\" SET deleted_at = datetime('now') WHERE id = ?",
                        arguments: [mutation.rowId]
                    )
                } else {
                    let payload = String(data: try encoder.encode(mutation.data ?? [:]), encoding: .utf8) ?? "{}"
                    try conn.execute(
                        sql: """
                            INSERT INTO "\(table)" (id, sync_version, deleted_at, data) VALUES (?, ?, NULL, ?)
                            ON CONFLICT(id) DO UPDATE SET deleted_at = NULL, data = excluded.data
                            """,
                        arguments: [mutation.rowId, base ?? 0, payload]
                    )
                }
                let opPayload = String(data: try encoder.encode(mutation.data ?? [:]), encoding: .utf8) ?? "{}"
                try conn.execute(
                    sql: """
                        INSERT INTO _sync_outbox
                            (op_id, resource, row_id, type, base_version, payload, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
                        """,
                    arguments: [SyncID.uuidV7(), mutation.resource, mutation.rowId, mutation.type.rawValue,
                                base.map(String.init), opPayload]
                )
            }
        }
    }

    public func pendingOps(limit: Int) async throws -> [SyncPushOp] {
        let boundedDatabase = self.boundedDatabase
        let decoder = self.decoder
        return try await onQueue {
            try boundedDatabase.read { conn in
                let rows = try Row.fetchAll(
                    conn,
                    sql: """
                        SELECT op_id, resource, row_id, type, base_version, payload FROM _sync_outbox
                        WHERE status = 'pending' ORDER BY created_at, op_id LIMIT ?
                        """,
                    arguments: [limit]
                )
                return try rows.map { row in
                    let payload: [String: JSONValue] = try (row["payload"] as String?)
                        .flatMap { $0.data(using: .utf8) }
                        .map { try decoder.decode([String: JSONValue].self, from: $0) } ?? [:]
                    return SyncPushOp(
                        opId: row["op_id"],
                        resource: row["resource"],
                        rowId: row["row_id"],
                        type: SyncChangeOp(rawValue: row["type"]) ?? .upsert,
                        baseVersion: row["base_version"],
                        data: payload.isEmpty ? nil : payload
                    )
                }
            }
        }
    }

    public func complete(_ results: [SyncPushResult]) async throws {
        let boundedDatabase = self.boundedDatabase
        try await onQueue {
            try boundedDatabase.write { conn in
                for result in results {
                    switch result.status {
                    case .applied, .conflict:
                        if result.status == .conflict {
                            let meta = try Row.fetchOne(
                                conn, sql: "SELECT resource, row_id FROM _sync_outbox WHERE op_id = ?",
                                arguments: [result.opId]
                            )
                            try conn.execute(
                                sql: """
                                    INSERT INTO _sync_conflicts (op_id, resource, row_id, reason, resolved_at)
                                    VALUES (?, ?, ?, ?, datetime('now'))
                                    """,
                                arguments: [
                                    result.opId, meta?["resource"] as String?, meta?["row_id"] as String?,
                                    result.reason
                                ]
                            )
                        }
                        try conn.execute(sql: "DELETE FROM _sync_outbox WHERE op_id = ?", arguments: [result.opId])
                    case .rejected:
                        try conn.execute(
                            sql: """
                                UPDATE _sync_outbox SET status = 'quarantined', attempts = attempts + 1
                                WHERE op_id = ?
                                """,
                            arguments: [result.opId]
                        )
                    }
                }
            }
        }
    }

    public func resetForResync() async throws {
        let boundedDatabase = self.boundedDatabase
        try await onQueue {
            try boundedDatabase.write { conn in
                let tables = try String.fetchAll(conn, sql: "SELECT resource FROM _sync_resources")
                for resource in tables {
                    try conn.execute(sql: "DELETE FROM \"\(Self.mirrorTableName(for: resource))\"")
                }
                try conn.execute(sql: "DELETE FROM _sync_state")
            }
        }
    }

    // MARK: - Read helpers (hosts: daemon serving + UI observation)

    public func liveRows(resource: String, limit: Int = 100, offset: Int = 0) throws -> [[String: JSONValue]] {
        let table = Self.mirrorTableName(for: resource)
        return try boundedDatabase.read { conn in
            let rows = try Row.fetchAll(
                conn,
                sql: "SELECT id, data FROM \"\(table)\" WHERE deleted_at IS NULL ORDER BY id LIMIT ? OFFSET ?",
                arguments: [limit, offset]
            )
            return try rows.map { try self.materialize($0) }
        }
    }

    public func liveRow(resource: String, id: String) throws -> [String: JSONValue]? {
        let table = Self.mirrorTableName(for: resource)
        return try boundedDatabase.read { conn in
            try Row.fetchOne(
                conn,
                sql: "SELECT id, data FROM \"\(table)\" WHERE id = ? AND deleted_at IS NULL",
                arguments: [id]
            ).map { try self.materialize($0) }
        }
    }

    private func materialize(_ row: Row) throws -> [String: JSONValue] {
        var object = try ((row["data"] as String?)?.data(using: .utf8))
            .map { try decoder.decode([String: JSONValue].self, from: $0) } ?? [:]
        object["id"] = .string(row["id"])
        return object
    }

    public func registeredResources() throws -> Set<String> {
        try boundedDatabase.read { conn in
            Set(try String.fetchAll(conn, sql: "SELECT resource FROM _sync_resources"))
        }
    }

    public func status() throws -> GRDBSyncStoreStatus {
        try boundedDatabase.read { conn in
            let outboxDepth = try Int.fetchOne(
                conn, sql: "SELECT COUNT(*) FROM _sync_outbox WHERE status = 'pending'"
            ) ?? 0
            let quarantinedDepth = try Int.fetchOne(
                conn, sql: "SELECT COUNT(*) FROM _sync_outbox WHERE status = 'quarantined'"
            ) ?? 0
            return GRDBSyncStoreStatus(
                cursor: try String.fetchOne(conn, sql: "SELECT cursor FROM _sync_state WHERE id = 1"),
                outboxDepth: outboxDepth,
                quarantinedDepth: quarantinedDepth,
                conflictCount: try Int.fetchOne(conn, sql: "SELECT COUNT(*) FROM _sync_conflicts") ?? 0
            )
        }
    }
}

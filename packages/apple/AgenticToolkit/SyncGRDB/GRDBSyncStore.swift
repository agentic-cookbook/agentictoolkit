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
/// preserving the outbox and the file; purgeForIdentityChange additionally
/// clears the outbox — see its doc comment for why — but still never touches
/// the file).
public final class GRDBSyncStore: SyncStore, @unchecked Sendable {

    private let boundedDatabase: BoundedDatabase
    private let queue = DispatchQueue(label: "GRDBSyncStore")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(database: BoundedDatabase) {
        self.boundedDatabase = database
    }

    public var database: BoundedDatabase { boundedDatabase }

    /// Resource strings are interpolated directly into SQL as identifiers
    /// (SQLite has no bind-parameter syntax for identifiers), so this is the
    /// one chokepoint every caller below routes through — reject anything
    /// outside `[a-z0-9_.]` before it ever reaches a query string (sync
    /// fix-wave item p2l).
    public static func mirrorTableName(for resource: String) throws -> String {
        let allowed = Set("abcdefghijklmnopqrstuvwxyz0123456789_.")
        guard !resource.isEmpty, resource.allSatisfy({ allowed.contains($0) }) else {
            throw SyncStoreFailure.unknownResource(resource)
        }
        return resource.replacingOccurrences(of: ".", with: "_")
    }

    private func onQueue<T: Sendable>(_ body: @escaping @Sendable () throws -> T) async throws -> T {
        try await withCheckedThrowingContinuation { continuation in
            queue.async {
                continuation.resume(with: Result { try body() })
            }
        }
    }

    // MARK: - SyncStore

    /// The bookkeeping tables (as opposed to per-resource mirror tables).
    /// Idempotent (`CREATE TABLE IF NOT EXISTS`) so it's safe to run from
    /// both `prepare(resources:)` and `cursor()` — the engine's pull loop
    /// calls `cursor()` before it has a manifest to hand `prepare`, so on a
    /// truly cold store (no prior `prepare` call ever made) `cursor()` would
    /// otherwise throw "no such table: _sync_state" on the very first sync.
    private static let bookkeepingSchema = """
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
        """

    public func prepare(resources: [SyncResource]) async throws {
        let boundedDatabase = self.boundedDatabase
        try await onQueue {
            try boundedDatabase.write { conn in
                try conn.execute(sql: Self.bookkeepingSchema)
                for resource in resources {
                    let table = try Self.mirrorTableName(for: resource.resource)
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
            try boundedDatabase.write { conn in
                try conn.execute(sql: Self.bookkeepingSchema)
                return try String.fetchOne(conn, sql: "SELECT cursor FROM _sync_state WHERE id = 1")
            }.map(SyncCursor.init(rawValue:))
        }
    }

    public func apply(_ batch: [SyncChange], advancingTo cursor: SyncCursor?) async throws {
        let boundedDatabase = self.boundedDatabase
        let encoder = self.encoder
        try await onQueue {
            try boundedDatabase.write { conn in
                for change in batch {
                    let isKnown = try Bool.fetchOne(
                        conn, sql: "SELECT EXISTS(SELECT 1 FROM _sync_resources WHERE resource = ?)",
                        arguments: [change.resource]
                    ) ?? false
                    guard isKnown else {
                        throw SyncStoreFailure.unknownResource(change.resource)
                    }
                    let table = try Self.mirrorTableName(for: change.resource)
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

    /// Local mutation: optimistic mirror write + outbox op, atomic. If a
    /// `pending` (not yet `inflight`/`quarantined`) outbox op already exists
    /// for this (resource, rowId), it is coalesced in place — same opId,
    /// same original `baseVersion` (the version the user's edits started
    /// from) — rather than minting a second op with a now-stale baseVersion
    /// that would conflict against the first on push. See sync fix-wave
    /// item p2a: two ops with the same baseVersion → server applies the
    /// first and stale-conflicts the second, silently dropping the newer
    /// edit.
    ///
    /// The resource must already be registered via `prepare(resources:)` —
    /// staging offline for an unprepared resource throws
    /// `SyncStoreFailure.unknownResource` rather than a raw SQL error
    /// against a mirror table that was never created (sync fix-wave item
    /// p2o).
    public func stage(_ mutation: LocalMutation) async throws {
        let boundedDatabase = self.boundedDatabase
        let encoder = self.encoder
        let decoder = self.decoder
        try await onQueue {
            try boundedDatabase.write { conn in
                let isKnown = try Bool.fetchOne(
                    conn, sql: "SELECT EXISTS(SELECT 1 FROM _sync_resources WHERE resource = ?)",
                    arguments: [mutation.resource]
                ) ?? false
                guard isKnown else {
                    throw SyncStoreFailure.unknownResource(mutation.resource)
                }
                let table = try Self.mirrorTableName(for: mutation.resource)
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

                let existing = try Row.fetchOne(
                    conn,
                    sql: """
                        SELECT op_id, payload FROM _sync_outbox
                        WHERE resource = ? AND row_id = ? AND status = 'pending' LIMIT 1
                        """,
                    arguments: [mutation.resource, mutation.rowId]
                )
                if let existing {
                    let opId: String = existing["op_id"]
                    let mergedPayload: [String: JSONValue]
                    switch mutation.type {
                    case .upsert:
                        let existingPayload: [String: JSONValue] = try (existing["payload"] as String?)
                            .flatMap { $0.data(using: .utf8) }
                            .map { try decoder.decode([String: JSONValue].self, from: $0) } ?? [:]
                        mergedPayload = existingPayload.merging(mutation.data ?? [:]) { _, new in new }
                    case .delete:
                        mergedPayload = [:]
                    }
                    let mergedPayloadString = String(data: try encoder.encode(mergedPayload), encoding: .utf8) ?? "{}"
                    try conn.execute(
                        sql: "UPDATE _sync_outbox SET type = ?, payload = ? WHERE op_id = ?",
                        arguments: [mutation.type.rawValue, mergedPayloadString, opId]
                    )
                } else {
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
    }

    /// Returns up to `limit` outbox ops in insertion order (`rowid` — the
    /// FIFO order the ops were created in), and marks every returned op
    /// `inflight` in the same transaction. Ops already `inflight` (from a
    /// prior call whose push never completed — a crash, or a server
    /// round-trip still outstanding) are included again: replaying the same
    /// opIds on retry is the server contract's idempotency guarantee.
    public func pendingOps(limit: Int) async throws -> [SyncPushOp] {
        let boundedDatabase = self.boundedDatabase
        let decoder = self.decoder
        return try await onQueue {
            try boundedDatabase.write { conn in
                let rows = try Row.fetchAll(
                    conn,
                    sql: """
                        SELECT op_id, resource, row_id, type, base_version, payload FROM _sync_outbox
                        WHERE status IN ('pending', 'inflight') ORDER BY rowid LIMIT ?
                        """,
                    arguments: [limit]
                )
                let opIds: [String] = rows.map { $0["op_id"] }
                if !opIds.isEmpty {
                    let placeholders = Array(repeating: "?", count: opIds.count).joined(separator: ", ")
                    try conn.execute(
                        sql: "UPDATE _sync_outbox SET status = 'inflight' WHERE op_id IN (\(placeholders))",
                        arguments: StatementArguments(opIds)
                    )
                }
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
                        let meta = try Row.fetchOne(
                            conn, sql: "SELECT resource, row_id FROM _sync_outbox WHERE op_id = ?",
                            arguments: [result.opId]
                        )
                        if result.status == .conflict {
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
                        } else if let newVersion = result.newVersion,
                                  let resource = meta?["resource"] as String?,
                                  let rowId = meta?["row_id"] as String? {
                            // Adopt the server's post-apply sync_version onto the mirror
                            // row BEFORE deleting the outbox row, in the same
                            // transaction, so a stage() call racing this completion
                            // (or arriving right after it) snapshots the correct
                            // baseVersion — closing the stage-during-push
                            // self-conflict race (adh sync.md §3).
                            let table = try Self.mirrorTableName(for: resource)
                            try conn.execute(
                                sql: "UPDATE \"\(table)\" SET sync_version = ? WHERE id = ?",
                                arguments: [Int(newVersion) ?? 0, rowId]
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
                    try conn.execute(sql: "DELETE FROM \"\(try Self.mirrorTableName(for: resource))\"")
                }
                try conn.execute(sql: "DELETE FROM _sync_state")
            }
        }
    }

    /// Account-boundary purge: call this when the signed-in identity itself
    /// changes (sign-out, switch account) — not for an ordinary resync.
    /// In one write transaction: every registered mirror table is emptied,
    /// `_sync_state` (the cursor) is cleared, and every `_sync_outbox` row is
    /// deleted regardless of status — `pending`, `inflight`, *and*
    /// `quarantined` alike.
    ///
    /// This is the deliberate difference from `resetForResync()`, which
    /// preserves the outbox: a resync happens because the *data* needs
    /// re-fetching while the identity performing it is unchanged, so
    /// queued local edits are still owed to the server under that same
    /// identity and must survive. Here the identity itself is changing —
    /// every queued op belongs to the *departing* identity, and pushing it
    /// under a new identity's credentials would misattribute the mutation.
    /// That's the defect this method exists to close; nothing may survive
    /// the boundary except the app-level resource registrations.
    ///
    /// `_sync_resources` is intentionally left untouched: it's the set of
    /// resources this app knows how to sync (from `prepare(resources:)`),
    /// not per-identity state — the next identity needs the same
    /// registrations, and callers should not need to re-`prepare` before
    /// their first post-purge `stage(_:)`.
    ///
    /// `_sync_conflicts` (the audit log) is also left untouched — it's a
    /// historical record, not live sync state, and isn't read back into any
    /// sync decision.
    ///
    /// Like `resetForResync()`, this never touches the database file itself
    /// — only rows within it, in one transaction.
    public func purgeForIdentityChange() async throws {
        let boundedDatabase = self.boundedDatabase
        try await onQueue {
            try boundedDatabase.write { conn in
                let tables = try String.fetchAll(conn, sql: "SELECT resource FROM _sync_resources")
                for resource in tables {
                    try conn.execute(sql: "DELETE FROM \"\(try Self.mirrorTableName(for: resource))\"")
                }
                try conn.execute(sql: "DELETE FROM _sync_state")
                try conn.execute(sql: "DELETE FROM _sync_outbox")
            }
        }
    }

    // MARK: - Read helpers (hosts: daemon serving + UI observation)

    /// The resource must already be registered via `prepare(resources:)`;
    /// an unregistered resource throws `SyncStoreFailure.unknownResource`
    /// (checked against `_sync_resources` before the mirror table is even
    /// named — sync fix-wave item p2o).
    public func liveRows(resource: String, limit: Int = 100, offset: Int = 0) throws -> [[String: JSONValue]] {
        try boundedDatabase.read { conn in
            let isKnown = try Bool.fetchOne(
                conn, sql: "SELECT EXISTS(SELECT 1 FROM _sync_resources WHERE resource = ?)",
                arguments: [resource]
            ) ?? false
            guard isKnown else {
                throw SyncStoreFailure.unknownResource(resource)
            }
            let table = try Self.mirrorTableName(for: resource)
            let rows = try Row.fetchAll(
                conn,
                sql: "SELECT id, data FROM \"\(table)\" WHERE deleted_at IS NULL ORDER BY id LIMIT ? OFFSET ?",
                arguments: [limit, offset]
            )
            return try rows.map { try self.materialize($0) }
        }
    }

    /// Same unregistered-resource contract as `liveRows` above.
    public func liveRow(resource: String, id: String) throws -> [String: JSONValue]? {
        try boundedDatabase.read { conn in
            let isKnown = try Bool.fetchOne(
                conn, sql: "SELECT EXISTS(SELECT 1 FROM _sync_resources WHERE resource = ?)",
                arguments: [resource]
            ) ?? false
            guard isKnown else {
                throw SyncStoreFailure.unknownResource(resource)
            }
            let table = try Self.mirrorTableName(for: resource)
            return try Row.fetchOne(
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
            // pending + inflight: both are unresolved ops still owed to the
            // server (inflight just means a push round-trip is outstanding).
            let outboxDepth = try Int.fetchOne(
                conn, sql: "SELECT COUNT(*) FROM _sync_outbox WHERE status IN ('pending', 'inflight')"
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

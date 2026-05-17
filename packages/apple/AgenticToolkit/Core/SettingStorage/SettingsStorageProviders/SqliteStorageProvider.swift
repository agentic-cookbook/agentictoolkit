//
//  SqliteStorageProvider.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/27/26.
//
import Foundation
import Combine
import SQLite3
import os

/// A `SettingsStorageProvider` backed by an SQLite database file.
///
/// Stores values JSON-encoded in a `settings_kv` table with `key TEXT PRIMARY KEY,
/// value BLOB NOT NULL`. Owns the underlying `sqlite3` handle and closes it on deinit.
@MainActor
public final class SqliteStorageProvider: SettingsStorageProvider {

    // MARK: - State

    nonisolated(unsafe) private var database: OpaquePointer?
    private let path: String
    private let queue = DispatchQueue(label: "SqliteStorageProvider")
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let changeSubject = PassthroughSubject<String, Never>()

    public var changes: AnyPublisher<String, Never> {
        changeSubject.eraseToAnyPublisher()
    }

    // MARK: - Initialization

    /// Opens (creating if absent) a SQLite database at `path`.
    public init(
        path: String,
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) throws {
        self.path = path
        self.encoder = encoder
        self.decoder = decoder

        var handle: OpaquePointer?
        let openResult = sqlite3_open(path, &handle)
        guard openResult == SQLITE_OK, let handle else {
            let message = handle.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            sqlite3_close(handle)
            throw SqliteSettingsError.cannotOpen(path: path, message: message)
        }
        self.database = handle

        // Create the schema if needed.
        let createResult = sqlite3_exec(
            handle,
            "CREATE TABLE IF NOT EXISTS settings_kv (key TEXT PRIMARY KEY, value BLOB NOT NULL);",
            nil, nil, nil
        )
        guard createResult == SQLITE_OK else {
            let message = String(cString: sqlite3_errmsg(handle))
            sqlite3_close(handle)
            self.database = nil
            throw SqliteSettingsError.schemaFailed(message: message)
        }
    }

    deinit {
        if let database {
            sqlite3_close(database)
        }
    }

    // MARK: - SettingsStorageProvider

    public func get<Value: Codable & Sendable>(_ key: any StorableSetting<Value>) -> Value {
        let data: Data? = queue.sync {
            self.readData(forKey: key.name)
        }
        guard let data, let value = try? decoder.decode(Value.self, from: data) else {
            return key.defaultValue
        }
        return value
    }

    public func set<Value: Codable & Sendable>(_ value: Value, for key: any StorableSetting<Value>) {
        guard let data = try? encoder.encode(value) else {
            Self.logger.error("Failed to encode value for key '\(key.name, privacy: .public)'")
            return
        }
        let success: Bool = queue.sync {
            self.writeData(data, forKey: key.name)
        }
        if success {
            changeSubject.send(key.name)
        }
    }

    public func remove<Value: Codable & Sendable>(_ key: any StorableSetting<Value>) {
        let success: Bool = queue.sync {
            self.deleteRow(forKey: key.name)
        }
        if success {
            changeSubject.send(key.name)
        }
    }

    public func contains<Value: Codable & Sendable>(_ key: any StorableSetting<Value>) -> Bool {
        queue.sync {
            self.rowExists(forKey: key.name)
        }
    }

    // MARK: - SQL helpers (run on `queue`)

    private func readData(forKey name: String) -> Data? {
        guard let database else { return nil }
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        let prepare = sqlite3_prepare_v2(database, "SELECT value FROM settings_kv WHERE key = ?;", -1, &statement, nil)
        guard prepare == SQLITE_OK else {
            Self.logger.error("prepare SELECT failed: \(String(cString: sqlite3_errmsg(database)), privacy: .public)")
            return nil
        }
        sqlite3_bind_text(statement, 1, (name as NSString).utf8String, -1, Self.transient)
        guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
        guard let bytes = sqlite3_column_blob(statement, 0) else { return nil }
        let length = Int(sqlite3_column_bytes(statement, 0))
        return Data(bytes: bytes, count: length)
    }

    private func writeData(_ data: Data, forKey name: String) -> Bool {
        guard let database else { return false }
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        let prepare = sqlite3_prepare_v2(
            database,
            "INSERT INTO settings_kv (key, value) VALUES (?, ?) " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
            -1, &statement, nil
        )
        guard prepare == SQLITE_OK else {
            Self.logger.error("prepare UPSERT failed: \(String(cString: sqlite3_errmsg(database)), privacy: .public)")
            return false
        }
        sqlite3_bind_text(statement, 1, (name as NSString).utf8String, -1, Self.transient)
        let bound = data.withUnsafeBytes { (buffer: UnsafeRawBufferPointer) -> Int32 in
            sqlite3_bind_blob(statement, 2, buffer.baseAddress, Int32(buffer.count), Self.transient)
        }
        guard bound == SQLITE_OK else {
            Self.logger.error("bind blob failed: \(String(cString: sqlite3_errmsg(database)), privacy: .public)")
            return false
        }
        guard sqlite3_step(statement) == SQLITE_DONE else {
            Self.logger.error("UPSERT step failed: \(String(cString: sqlite3_errmsg(database)), privacy: .public)")
            return false
        }
        return true
    }

    private func deleteRow(forKey name: String) -> Bool {
        guard let database else { return false }
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        let prepare = sqlite3_prepare_v2(database, "DELETE FROM settings_kv WHERE key = ?;", -1, &statement, nil)
        guard prepare == SQLITE_OK else { return false }
        sqlite3_bind_text(statement, 1, (name as NSString).utf8String, -1, Self.transient)
        return sqlite3_step(statement) == SQLITE_DONE
    }

    private func rowExists(forKey name: String) -> Bool {
        guard let database else { return false }
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        let sql = "SELECT 1 FROM settings_kv WHERE key = ? LIMIT 1;"
        let prepare = sqlite3_prepare_v2(database, sql, -1, &statement, nil)
        guard prepare == SQLITE_OK else { return false }
        sqlite3_bind_text(statement, 1, (name as NSString).utf8String, -1, Self.transient)
        return sqlite3_step(statement) == SQLITE_ROW
    }

    /// SQLite needs a non-static, transient binder so it copies the bound bytes.
    private static let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
}

extension SqliteStorageProvider: Loggable {
    public static nonisolated let logger = makeLogger()
}

// MARK: - Errors

public enum SqliteSettingsError: Error, LocalizedError {
    case cannotOpen(path: String, message: String)
    case schemaFailed(message: String)

    public var errorDescription: String? {
        switch self {
        case .cannotOpen(let path, let message):
            return "Cannot open SQLite settings DB at \(path): \(message)"
        case .schemaFailed(let message):
            return "Failed to create settings_kv table: \(message)"
        }
    }
}

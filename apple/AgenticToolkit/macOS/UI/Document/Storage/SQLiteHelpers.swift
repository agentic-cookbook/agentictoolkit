import Foundation
import SQLite3

/// Shared SQLite3 utility helpers used by project and workspace stores.
public enum SQLiteHelpers {

    public enum Binding {
        case text(String)
        case int(Int64)
    }

    public enum SQLiteError: LocalizedError {
        case cannotOpen(String)
        case execFailed(String)
        case missingData(String)
        case invalidDate(String)

        public var errorDescription: String? {
            switch self {
            case .cannotOpen(let msg): return "Cannot open database: \(msg)"
            case .execFailed(let msg): return "SQL execution failed: \(msg)"
            case .missingData(let msg): return "Missing data: \(msg)"
            case .invalidDate(let value): return "Invalid date format: \(value)"
            }
        }
    }

    public static func tempDatabaseURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("db")
    }

    public static func openDatabase(at url: URL) throws -> OpaquePointer {
        var database: OpaquePointer?
        let result = sqlite3_open(url.path, &database)
        guard result == SQLITE_OK, let database = database else {
            let msg = database.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            throw SQLiteError.cannotOpen(msg)
        }
        return database
    }

    /// Executes SQL with no result set. Supports parameterized bindings.
    public static func exec(_ database: OpaquePointer, _ sql: String, bindings: [Binding] = []) throws {
        if bindings.isEmpty {
            var errMsg: UnsafeMutablePointer<CChar>?
            let result = sqlite3_exec(database, sql, nil, nil, &errMsg)
            if result != SQLITE_OK {
                let msg = errMsg.map { String(cString: $0) } ?? "unknown"
                sqlite3_free(errMsg)
                throw SQLiteError.execFailed(msg)
            }
            return
        }

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw SQLiteError.execFailed(String(cString: sqlite3_errmsg(database)))
        }
        defer { sqlite3_finalize(stmt) }

        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        for (index, binding) in bindings.enumerated() {
            let idx = Int32(index + 1)
            switch binding {
            case .text(let text):
                sqlite3_bind_text(stmt, idx, (text as NSString).utf8String, -1, transient)
            case .int(let value):
                sqlite3_bind_int64(stmt, idx, value)
            }
        }

        let result = sqlite3_step(stmt)
        guard result == SQLITE_DONE else {
            throw SQLiteError.execFailed(String(cString: sqlite3_errmsg(database)))
        }
    }

    /// Queries a single row, returning columns as strings.
    public static func queryRow(_ database: OpaquePointer, _ sql: String) throws -> [String] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw SQLiteError.execFailed(String(cString: sqlite3_errmsg(database)))
        }
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_step(stmt) == SQLITE_ROW else { return [] }

        let count = sqlite3_column_count(stmt)
        return (0..<count).map { index in
            sqlite3_column_text(stmt, index).map { String(cString: $0) } ?? ""
        }
    }

    /// Queries all rows, returning each as an array of strings.
    public static func queryAll(_ database: OpaquePointer, _ sql: String) throws -> [[String]] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw SQLiteError.execFailed(String(cString: sqlite3_errmsg(database)))
        }
        defer { sqlite3_finalize(stmt) }

        var rows: [[String]] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let count = sqlite3_column_count(stmt)
            let row = (0..<count).map { index in
                sqlite3_column_text(stmt, index).map { String(cString: $0) } ?? ""
            }
            rows.append(row)
        }
        return rows
    }

    /// Returns the last inserted row ID.
    public static func lastInsertRowID(_ database: OpaquePointer) -> Int64 {
        sqlite3_last_insert_rowid(database)
    }
}

// MARK: - Bool String Extension

extension Bool {
    public init?(fromSQLite string: String) {
        switch string.lowercased() {
        case "true", "1", "yes": self = true
        case "false", "0", "no": self = false
        default: return nil
        }
    }
}

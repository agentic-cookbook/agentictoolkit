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
            case .invalidDate(let s): return "Invalid date format: \(s)"
            }
        }
    }

    public static func tempDatabaseURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("db")
    }

    public static func openDatabase(at url: URL) throws -> OpaquePointer {
        var db: OpaquePointer?
        let rc = sqlite3_open(url.path, &db)
        guard rc == SQLITE_OK, let db = db else {
            let msg = db.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            throw SQLiteError.cannotOpen(msg)
        }
        return db
    }

    /// Executes SQL with no result set. Supports parameterized bindings.
    public static func exec(_ db: OpaquePointer, _ sql: String, bindings: [Binding] = []) throws {
        if bindings.isEmpty {
            var errMsg: UnsafeMutablePointer<CChar>?
            let rc = sqlite3_exec(db, sql, nil, nil, &errMsg)
            if rc != SQLITE_OK {
                let msg = errMsg.map { String(cString: $0) } ?? "unknown"
                sqlite3_free(errMsg)
                throw SQLiteError.execFailed(msg)
            }
            return
        }

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw SQLiteError.execFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }

        for (i, binding) in bindings.enumerated() {
            let idx = Int32(i + 1)
            switch binding {
            case .text(let s):
                sqlite3_bind_text(stmt, idx, (s as NSString).utf8String, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self))
            case .int(let v):
                sqlite3_bind_int64(stmt, idx, v)
            }
        }

        let rc = sqlite3_step(stmt)
        guard rc == SQLITE_DONE else {
            throw SQLiteError.execFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    /// Queries a single row, returning columns as strings.
    public static func queryRow(_ db: OpaquePointer, _ sql: String) throws -> [String] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw SQLiteError.execFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_step(stmt) == SQLITE_ROW else { return [] }

        let count = sqlite3_column_count(stmt)
        return (0..<count).map { i in
            sqlite3_column_text(stmt, i).map { String(cString: $0) } ?? ""
        }
    }

    /// Queries all rows, returning each as an array of strings.
    public static func queryAll(_ db: OpaquePointer, _ sql: String) throws -> [[String]] {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw SQLiteError.execFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(stmt) }

        var rows: [[String]] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let count = sqlite3_column_count(stmt)
            let row = (0..<count).map { i in
                sqlite3_column_text(stmt, i).map { String(cString: $0) } ?? ""
            }
            rows.append(row)
        }
        return rows
    }

    /// Returns the last inserted row ID.
    public static func lastInsertRowID(_ db: OpaquePointer) -> Int64 {
        sqlite3_last_insert_rowid(db)
    }
}

// MARK: - Bool String Extension

public extension Bool {
    public init?(fromSQLite string: String) {
        switch string.lowercased() {
        case "true", "1", "yes": self = true
        case "false", "0", "no": self = false
        default: return nil
        }
    }
}

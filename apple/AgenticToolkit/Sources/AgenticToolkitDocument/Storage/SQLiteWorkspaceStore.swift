import AgenticToolkitFileBrowser
import Foundation
import SQLite3

/// Serializes and deserializes `Workspace` to/from SQLite3 database bytes.
public enum SQLiteWorkspaceStore {

    public static let formatVersion: Int32 = 1

    public static func serialize(_ workspace: Workspace) throws -> Data {
        let tempURL = SQLiteHelpers.tempDatabaseURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let db = try SQLiteHelpers.openDatabase(at: tempURL)
        defer { sqlite3_close(db) }

        try SQLiteHelpers.exec(db, """
            PRAGMA journal_mode = OFF;
            PRAGMA user_version = \(formatVersion);
            PRAGMA foreign_keys = ON;
            CREATE TABLE workspace (
                name TEXT NOT NULL,
                schema_version INTEGER NOT NULL,
                created_date TEXT NOT NULL
            );
            CREATE TABLE entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK(type IN ('project', 'directory')),
                path TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                added_date TEXT NOT NULL
            );
            CREATE TABLE discovered_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
                project_path TEXT NOT NULL UNIQUE,
                project_name TEXT NOT NULL,
                last_seen TEXT NOT NULL
            );
            CREATE TABLE settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );
        """)

        let fmt = ISO8601DateFormatter()

        try SQLiteHelpers.exec(db, "INSERT INTO workspace (name, schema_version, created_date) VALUES (?, ?, ?)",
            bindings: [.text(workspace.name), .int(Int64(workspace.version)), .text(fmt.string(from: workspace.createdDate))])

        for entry in workspace.entries {
            try SQLiteHelpers.exec(db, "INSERT INTO entries (id, type, path, name, added_date) VALUES (?, ?, ?, ?, ?)",
                bindings: [.int(Int64(entry.id)), .text(entry.type.rawValue), .text(entry.path), .text(entry.name), .text(fmt.string(from: entry.addedDate))])
        }

        for dp in workspace.discoveredProjects {
            try SQLiteHelpers.exec(db, "INSERT INTO discovered_projects (id, entry_id, project_path, project_name, last_seen) VALUES (?, ?, ?, ?, ?)",
                bindings: [.int(Int64(dp.id)), .int(Int64(dp.entryID)), .text(dp.projectPath), .text(dp.projectName), .text(fmt.string(from: dp.lastSeen))])
        }

        try SQLiteHelpers.exec(db, "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            bindings: [.text("sidebarProportion"), .text(String(workspace.settings.sidebarProportion))])

        sqlite3_close(db)
        let data = try Data(contentsOf: tempURL)
        Log.workspace.info("Serialized workspace to SQLite: \(data.count) bytes")
        return data
    }

    public static func deserialize(_ data: Data) throws -> Workspace {
        let tempURL = SQLiteHelpers.tempDatabaseURL()
        try data.write(to: tempURL)
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let db = try SQLiteHelpers.openDatabase(at: tempURL)
        defer { sqlite3_close(db) }

        let fmt = ISO8601DateFormatter()

        let wsRow = try SQLiteHelpers.queryRow(db, "SELECT name, schema_version, created_date FROM workspace LIMIT 1")
        guard wsRow.count == 3 else {
            throw SQLiteHelpers.SQLiteError.missingData("workspace table is empty")
        }
        let name = wsRow[0]
        let version = Int(wsRow[1]) ?? 1
        guard let createdDate = fmt.date(from: wsRow[2]) else {
            throw SQLiteHelpers.SQLiteError.invalidDate(wsRow[2])
        }

        let entryRows = try SQLiteHelpers.queryAll(db, "SELECT id, type, path, name, added_date FROM entries")
        let entries: [WorkspaceEntry] = entryRows.compactMap { row in
            guard row.count == 5,
                  let id = Int(row[0]),
                  let type = WorkspaceEntry.EntryType(rawValue: row[1]),
                  let date = fmt.date(from: row[4]) else { return nil }
            return WorkspaceEntry(id: id, type: type, path: row[2], name: row[3], addedDate: date)
        }

        let dpRows = try SQLiteHelpers.queryAll(db, "SELECT id, entry_id, project_path, project_name, last_seen FROM discovered_projects")
        let discovered: [DiscoveredProject] = dpRows.compactMap { row in
            guard row.count == 5,
                  let id = Int(row[0]),
                  let entryID = Int(row[1]),
                  let date = fmt.date(from: row[4]) else { return nil }
            return DiscoveredProject(id: id, entryID: entryID, projectPath: row[2], projectName: row[3], lastSeen: date)
        }

        let settingsRows = try SQLiteHelpers.queryAll(db, "SELECT key, value FROM settings")
        var settingsMap: [String: String] = [:]
        for r in settingsRows {
            guard r.count == 2 else { continue }
            settingsMap[r[0]] = r[1]
        }
        var settings = WorkspaceSettings()
        if let sp = settingsMap["sidebarProportion"].flatMap(Double.init) {
            settings.sidebarProportion = sp
        }

        Log.workspace.info("Deserialized workspace '\(name)' from SQLite (v\(version)), \(entries.count) entries")
        return Workspace(name: name, version: version, createdDate: createdDate, entries: entries, discoveredProjects: discovered, settings: settings)
    }
}

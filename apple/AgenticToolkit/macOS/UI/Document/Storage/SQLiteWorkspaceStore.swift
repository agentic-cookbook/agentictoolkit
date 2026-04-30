import AgenticToolkitCore
import Foundation
import OSLog
import SQLite3

/// Serializes and deserializes `Workspace` to/from SQLite3 database bytes.
public enum SQLiteWorkspaceStore {

    public static let formatVersion: Int32 = 1

    public static func serialize(_ workspace: Workspace) throws -> Data {
        let tempURL = SQLiteHelpers.tempDatabaseURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let database = try SQLiteHelpers.openDatabase(at: tempURL)
        defer { sqlite3_close(database) }

        try SQLiteHelpers.exec(database, """
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

        try SQLiteHelpers.exec(
            database,
            "INSERT INTO workspace (name, schema_version, created_date) VALUES (?, ?, ?)",
            bindings: [
                .text(workspace.name),
                .int(Int64(workspace.version)),
                .text(fmt.string(from: workspace.createdDate))
            ]
        )

        for entry in workspace.entries {
            try SQLiteHelpers.exec(
                database,
                "INSERT INTO entries (id, type, path, name, added_date) VALUES (?, ?, ?, ?, ?)",
                bindings: [
                    .int(Int64(entry.id)),
                    .text(entry.type.rawValue),
                    .text(entry.path),
                    .text(entry.name),
                    .text(fmt.string(from: entry.addedDate))
                ]
            )
        }

        for project in workspace.discoveredProjects {
            try SQLiteHelpers.exec(
                database,
                "INSERT INTO discovered_projects "
                + "(id, entry_id, project_path, project_name, last_seen) VALUES (?, ?, ?, ?, ?)",
                bindings: [
                    .int(Int64(project.id)),
                    .int(Int64(project.entryID)),
                    .text(project.projectPath),
                    .text(project.projectName),
                    .text(fmt.string(from: project.lastSeen))
                ]
            )
        }

        try SQLiteHelpers.exec(
            database,
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            bindings: [.text("sidebarProportion"), .text(String(workspace.settings.sidebarProportion))]
        )

        sqlite3_close(database)
        let data = try Data(contentsOf: tempURL)
        logger.info("Serialized workspace to SQLite: \(data.count) bytes")
        return data
    }

    public static func deserialize(_ data: Data) throws -> Workspace {
        let tempURL = SQLiteHelpers.tempDatabaseURL()
        try data.write(to: tempURL)
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let database = try SQLiteHelpers.openDatabase(at: tempURL)
        defer { sqlite3_close(database) }

        let fmt = ISO8601DateFormatter()

        let wsRow = try SQLiteHelpers.queryRow(
            database,
            "SELECT name, schema_version, created_date FROM workspace LIMIT 1"
        )
        guard wsRow.count == 3 else {
            throw SQLiteHelpers.SQLiteError.missingData("workspace table is empty")
        }
        let name = wsRow[0]
        let version = Int(wsRow[1]) ?? 1
        guard let createdDate = fmt.date(from: wsRow[2]) else {
            throw SQLiteHelpers.SQLiteError.invalidDate(wsRow[2])
        }

        let entryRows = try SQLiteHelpers.queryAll(
            database,
            "SELECT id, type, path, name, added_date FROM entries"
        )
        let entries: [WorkspaceEntry] = entryRows.compactMap { row in
            guard row.count == 5,
                  let id = Int(row[0]),
                  let type = WorkspaceEntry.EntryType(rawValue: row[1]),
                  let date = fmt.date(from: row[4]) else { return nil }
            return WorkspaceEntry(id: id, type: type, path: row[2], name: row[3], addedDate: date)
        }

        let dpRows = try SQLiteHelpers.queryAll(
            database,
            "SELECT id, entry_id, project_path, project_name, last_seen FROM discovered_projects"
        )
        let discovered: [DiscoveredProject] = dpRows.compactMap { row in
            guard row.count == 5,
                  let id = Int(row[0]),
                  let entryID = Int(row[1]),
                  let date = fmt.date(from: row[4]) else { return nil }
            return DiscoveredProject(
                id: id,
                entryID: entryID,
                projectPath: row[2],
                projectName: row[3],
                lastSeen: date
            )
        }

        let settingsRows = try SQLiteHelpers.queryAll(database, "SELECT key, value FROM settings")
        var settingsMap: [String: String] = [:]
        for row in settingsRows where row.count == 2 {
            settingsMap[row[0]] = row[1]
        }
        var settings = WorkspaceSettings()
        if let sidebar = settingsMap["sidebarProportion"].flatMap(Double.init) {
            settings.sidebarProportion = sidebar
        }

        logger.info("Deserialized workspace '\(name)' from SQLite (v\(version)), "
                    + "\(entries.count) entries")
        return Workspace(
            name: name,
            version: version,
            createdDate: createdDate,
            entries: entries,
            discoveredProjects: discovered,
            settings: settings
        )
    }
}

extension SQLiteWorkspaceStore: Loggable {
    public static nonisolated let logger = makeLogger()
}

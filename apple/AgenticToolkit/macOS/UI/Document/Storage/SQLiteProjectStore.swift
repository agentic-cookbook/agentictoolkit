import AgenticToolkitCore
import Foundation
import OSLog
import SQLite3

/// Serializes and deserializes `Project` to/from SQLite3 database bytes.
public enum SQLiteProjectStore {

    public static let formatVersion: Int32 = 3

    public static func serialize(_ project: Project) throws -> Data {
        let tempURL = SQLiteHelpers.tempDatabaseURL()
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let database = try SQLiteHelpers.openDatabase(at: tempURL)
        defer { sqlite3_close(database) }

        try SQLiteHelpers.exec(database, """
            PRAGMA journal_mode = OFF;
            PRAGMA user_version = \(formatVersion);
            CREATE TABLE project (
                name TEXT NOT NULL,
                schema_version INTEGER NOT NULL,
                created_date TEXT NOT NULL
            );
            CREATE TABLE settings (
                key TEXT PRIMARY KEY NOT NULL,
                value TEXT NOT NULL
            );
            CREATE TABLE sessions (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                sort_order INTEGER NOT NULL,
                layout_state TEXT NOT NULL
            );
        """)

        let dateString = ISO8601DateFormatter().string(from: project.createdDate)
        try SQLiteHelpers.exec(database, "INSERT INTO project (name, schema_version, created_date) VALUES (?, ?, ?)",
                 bindings: [.text(project.name), .int(Int64(project.version)), .text(dateString)])

        for (key, value) in project.settings.toKeyValueMap() {
            try SQLiteHelpers.exec(database, "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                     bindings: [.text(key), .text(value)])
        }

        let encoder = JSONEncoder()
        for record in project.sessionRecords {
            let layoutJSON = String(data: try encoder.encode(record.layoutState), encoding: .utf8) ?? "{}"
            try SQLiteHelpers.exec(
                database,
                "INSERT INTO sessions (id, name, sort_order, layout_state) VALUES (?, ?, ?, ?)",
                bindings: [
                    .text(record.id.uuidString),
                    .text(record.name),
                    .int(Int64(record.sortOrder)),
                    .text(layoutJSON)
                ]
            )
        }

        sqlite3_close(database)
        let data = try Data(contentsOf: tempURL)
        logger.info("Serialized project to SQLite: \(data.count) bytes")
        return data
    }

    public static func deserialize(_ data: Data) throws -> Project {
        let tempURL = SQLiteHelpers.tempDatabaseURL()
        try data.write(to: tempURL)
        defer { try? FileManager.default.removeItem(at: tempURL) }

        let database = try SQLiteHelpers.openDatabase(at: tempURL)
        defer { sqlite3_close(database) }

        let row = try SQLiteHelpers.queryRow(database, "SELECT name, schema_version, created_date FROM project LIMIT 1")
        guard row.count == 3 else {
            throw SQLiteHelpers.SQLiteError.missingData("project table is empty")
        }

        let name = row[0]
        let version = Int(row[1]) ?? 2
        guard let createdDate = ISO8601DateFormatter().date(from: row[2]) else {
            throw SQLiteHelpers.SQLiteError.invalidDate(row[2])
        }

        let settingsRows = try SQLiteHelpers.queryAll(database, "SELECT key, value FROM settings")
        var settingsMap: [String: String] = [:]
        for row in settingsRows where row.count == 2 {
            settingsMap[row[0]] = row[1]
        }

        let settings = ProjectSettings.fromKeyValueMap(settingsMap)

        // Read session records (table may not exist in v2 projects)
        var sessionRecords: [TerminalSessionSessionRecord] = []
        let decoder = JSONDecoder()
        let sessionsQuery = "SELECT id, name, sort_order, layout_state FROM sessions ORDER BY sort_order"
        if let sessionRows = try? SQLiteHelpers.queryAll(database, sessionsQuery) {
            for row in sessionRows where row.count == 4 {
                guard let uuid = UUID(uuidString: row[0]) else { continue }
                let sortOrder = Int(row[2]) ?? 0
                let layoutState: TerminalSessionLayoutState
                if let layoutData = row[3].data(using: .utf8),
                   let decoded = try? decoder.decode(TerminalSessionLayoutState.self, from: layoutData) {
                    layoutState = decoded
                } else {
                    layoutState = settings.defaultSessionLayout
                }
                sessionRecords.append(TerminalSessionSessionRecord(
                    id: uuid,
                    name: row[1],
                    sortOrder: sortOrder,
                    layoutState: layoutState
                ))
            }
        }

        logger.info("Deserialized project '\(name)' from SQLite "
                    + "(v\(version), \(sessionRecords.count) sessions)")
        var project = Project(name: name, version: version, createdDate: createdDate, settings: settings)
        project.sessionRecords = sessionRecords
        return project
    }
}

extension SQLiteProjectStore: Loggable {
    public static nonisolated let logger = makeLogger()
}

// MARK: - ProjectSettings Key-Value Conversion

extension ProjectSettings {
    public static func fromKeyValueMap(_ map: [String: String]) -> ProjectSettings {
        let defaults = ProjectSettings()
        var settings = ProjectSettings()
        settings.defaultShell = map["defaultShell"] ?? defaults.defaultShell
        settings.autoOpenTerminal = map["autoOpenTerminal"]
            .flatMap(Bool.init(fromSQLite:)) ?? defaults.autoOpenTerminal
        settings.isSessionPanelVisible = map["isSessionPanelVisible"]
            .flatMap(Bool.init(fromSQLite:)) ?? defaults.isSessionPanelVisible
        settings.sessionPanelProportion = map["sessionPanelProportion"]
            .flatMap(Double.init) ?? defaults.sessionPanelProportion
        settings.fileTreeProportion = map["fileTreeProportion"]
            .flatMap(Double.init) ?? defaults.fileTreeProportion
        settings.isFileTreeVisible = map["isFileTreeVisible"]
            .flatMap(Bool.init(fromSQLite:)) ?? defaults.isFileTreeVisible

        // Read defaultSessionLayout, falling back to legacy boolean fields for migration
        if let json = map["defaultSessionLayout"], let data = json.data(using: .utf8),
           let decoded = try? JSONDecoder().decode(TerminalSessionLayoutState.self, from: data) {
            settings.defaultSessionLayout = decoded
        } else {
            let isFileViewerVisible = map["isFileViewerVisible"].flatMap(Bool.init(fromSQLite:)) ?? true
            let isTerminalVisible = map["isTerminalVisible"].flatMap(Bool.init(fromSQLite:)) ?? true
            let isInspectorPresented = map["isInspectorPresented"].flatMap(Bool.init(fromSQLite:)) ?? false
            settings.defaultSessionLayout = .fromLegacy(
                isFileViewerVisible: isFileViewerVisible,
                isTerminalVisible: isTerminalVisible,
                isInspectorPresented: isInspectorPresented
            )
        }

        if let json = map["detectedIDEs"], let data = json.data(using: .utf8) {
            settings.detectedIDEs = (try? JSONDecoder().decode([IDEProject].self, from: data))
                ?? defaults.detectedIDEs
        }
        settings.ignorePatterns = defaults.ignorePatterns
        return settings
    }

    public func toKeyValueMap() -> [(String, String)] {
        let layoutJSON = (try? String(data: JSONEncoder().encode(defaultSessionLayout), encoding: .utf8)) ?? "{}"
        return [
            ("defaultShell", defaultShell),
            ("autoOpenTerminal", String(autoOpenTerminal)),
            ("isSessionPanelVisible", String(isSessionPanelVisible)),
            ("sessionPanelProportion", String(sessionPanelProportion)),
            ("fileTreeProportion", String(fileTreeProportion)),
            ("isFileTreeVisible", String(isFileTreeVisible)),
            ("defaultSessionLayout", layoutJSON),
            ("detectedIDEs", (try? String(data: JSONEncoder().encode(detectedIDEs), encoding: .utf8)) ?? "[]")
        ]
    }
}

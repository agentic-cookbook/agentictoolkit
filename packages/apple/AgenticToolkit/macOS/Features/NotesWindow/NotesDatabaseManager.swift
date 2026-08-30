import Foundation
import SQLite3
import AgenticToolkitCore
import os

/// SQLite-backed ``NoteStorage`` — the default note store for apps that embed the
/// Notes window.
///
/// Notes used to live in the SessionWatcher database, which coupled a user-facing
/// feature to the session-capture stack. This owns a `notes.db` of its own so the
/// two can be deleted independently.
///
/// The connection is opened and migrated in `init`, which `throws`. That is
/// deliberate: the predecessor split construction from a separate `open()` call,
/// nothing ever called it, and every write failed silently against a nil handle
/// for months. There is no way to hold an unopened instance of this class.
public final class NotesDatabaseManager: NoteStorage {

    // MARK: - Properties

    private var database: OpaquePointer?
    private let dbPath: String
    private let queue = DispatchQueue(label: "com.mikefullerton.notes.database", qos: .userInitiated)

    /// The current schema version. Increment this when adding new migrations.
    public static let currentSchemaVersion = 1

    private static let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    /// `unsafe` because `ISO8601DateFormatter` isn't `Sendable`. Every read and write of
    /// it happens inside a `_`-prefixed method, and those only ever run inside `queue`,
    /// so it is never touched concurrently. Re-creating it per row is not an option —
    /// allocating a formatter per record was a measurable hotspot in the old ingester.
    nonisolated(unsafe) private static let iso8601: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    /// Rows written by older builds carry fractional seconds ("2026-04-13T16:18:07.798Z"),
    /// which `.withInternetDateTime` alone will not parse.
    nonisolated(unsafe) private static let iso8601Fractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    /// Parses a stored timestamp, tolerating both the fractional and whole-second forms.
    ///
    /// Returns `nil` rather than defaulting to `Date()`: a silent "now" fallback here
    /// overwrites the note's real timestamps on the next save, which is how the previous
    /// store quietly reset every note's dates on each read.
    private static func parseDate(_ value: String) -> Date? {
        iso8601Fractional.date(from: value) ?? iso8601.date(from: value)
    }

    // MARK: - Initialization

    /// Opens (creating if needed) the note database and brings it up to schema.
    /// - Parameter path: Database file. Defaults to `<AppSupport>/<AppName>/notes.db`.
    public init(path: String? = nil) throws {
        self.dbPath = try path ?? NotesDatabaseManager.defaultDatabasePath()
        try openDatabase()
        try runMigrations()
        logger.info("Notes database ready at \(self.dbPath, privacy: .public)")
    }

    deinit {
        close()
    }

    /// `<AppSupport>/<CFBundleName>/notes.db` — e.g. `~/Library/Application Support/Whippet/notes.db`.
    static public func defaultDatabasePath() throws -> String {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first!
        let appName = (Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String) ?? "AgenticToolkit"
        let directory = appSupport.appendingPathComponent(appName)

        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)

        return directory.appendingPathComponent("notes.db").path
    }

    // MARK: - Connection

    private func openDatabase() throws {
        // FULLMUTEX (serialized mode): SQLite handles thread-safety internally.
        let result = sqlite3_open_v2(
            dbPath, &database,
            SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
            nil
        )
        guard result == SQLITE_OK else {
            let message = String(cString: sqlite3_errmsg(database))
            logger.error("Failed to open notes database: \(message, privacy: .public)")
            throw NotesDatabaseError.openFailed(message)
        }
        try execute("PRAGMA journal_mode=WAL")
    }

    public func close() {
        if let database {
            sqlite3_close(database)
            self.database = nil
        }
    }

    // MARK: - Migrations

    /// Notes now share a database file with the project registry in hosts that
    /// keep one database per app, so the bookkeeping table is namespaced. The
    /// rename costs nothing on an existing `notes.db`: migration 001 is
    /// `IF NOT EXISTS` throughout, so re-running it against an already-migrated
    /// file only re-records the version in the new table.
    private static let migrationsTable = "notes_schema_migrations"

    private func runMigrations() throws {
        try execute("""
        CREATE TABLE IF NOT EXISTS \(Self.migrationsTable) (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
    """)

        if try schemaVersion() < 1 {
            logger.info("Running notes migration 001: create notes table")
            try migration001_createNotes()
        }
    }

    private func schemaVersion() throws -> Int {
        let sql = "SELECT COALESCE(MAX(version), 0) FROM \(Self.migrationsTable)"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }

        guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw NotesDatabaseError.prepareFailed(lastErrorMessage)
        }
        guard sqlite3_step(stmt) == SQLITE_ROW else { return 0 }
        return Int(sqlite3_column_int(stmt, 0))
    }

    private func migration001_createNotes() throws {
        try execute("""
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL DEFAULT 'Untitled Note',
            content TEXT NOT NULL DEFAULT '',
            created_date TEXT NOT NULL,
            modified_date TEXT NOT NULL,
            is_pinned INTEGER NOT NULL DEFAULT 0
        )
    """)
        try execute("CREATE INDEX IF NOT EXISTS idx_notes_modified ON notes(modified_date)")
        try execute("CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes(is_pinned)")
        try execute("INSERT INTO \(Self.migrationsTable) (version) VALUES (1)")
    }

    // MARK: - SQL Helpers

    private var lastErrorMessage: String {
        if let database {
            return String(cString: sqlite3_errmsg(database))
        }
        return "Database not open"
    }

    @discardableResult
    private func execute(_ sql: String) throws -> Int32 {
        var errorMessage: UnsafeMutablePointer<CChar>?
        let result = sqlite3_exec(database, sql, nil, nil, &errorMessage)
        if result != SQLITE_OK {
            let message = errorMessage.map { String(cString: $0) } ?? "Unknown error"
            sqlite3_free(errorMessage)
            logger.error("Notes SQL failed: \(message, privacy: .public)")
            throw NotesDatabaseError.executionFailed(message)
        }
        return result
    }

    // MARK: - NoteStorage

    public func insertNote(_ note: Note) throws {
        try queue.sync { try _insertNote(note) }
    }

    private func _insertNote(_ note: Note) throws {
        let sql = """
        INSERT INTO notes (id, title, content, created_date, modified_date, is_pinned)
        VALUES (?, ?, ?, ?, ?, ?)
    """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw NotesDatabaseError.prepareFailed(lastErrorMessage)
        }
        let transient = NotesDatabaseManager.sqliteTransient
        let created = NotesDatabaseManager.iso8601.string(from: note.createdDate)
        let modified = NotesDatabaseManager.iso8601.string(from: note.modifiedDate)
        sqlite3_bind_text(stmt, 1, (note.id.uuidString as NSString).utf8String, -1, transient)
        sqlite3_bind_text(stmt, 2, (note.title as NSString).utf8String, -1, transient)
        sqlite3_bind_text(stmt, 3, (note.content as NSString).utf8String, -1, transient)
        sqlite3_bind_text(stmt, 4, (created as NSString).utf8String, -1, transient)
        sqlite3_bind_text(stmt, 5, (modified as NSString).utf8String, -1, transient)
        sqlite3_bind_int(stmt, 6, note.isPinned ? 1 : 0)
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw NotesDatabaseError.executionFailed(lastErrorMessage)
        }
    }

    public func updateNote(_ note: Note) throws {
        try queue.sync { try _updateNote(note) }
    }

    private func _updateNote(_ note: Note) throws {
        let sql = "UPDATE notes SET title=?, content=?, modified_date=?, is_pinned=? WHERE id=?"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw NotesDatabaseError.prepareFailed(lastErrorMessage)
        }
        let transient = NotesDatabaseManager.sqliteTransient
        let modified = NotesDatabaseManager.iso8601.string(from: note.modifiedDate)
        sqlite3_bind_text(stmt, 1, (note.title as NSString).utf8String, -1, transient)
        sqlite3_bind_text(stmt, 2, (note.content as NSString).utf8String, -1, transient)
        sqlite3_bind_text(stmt, 3, (modified as NSString).utf8String, -1, transient)
        sqlite3_bind_int(stmt, 4, note.isPinned ? 1 : 0)
        sqlite3_bind_text(stmt, 5, (note.id.uuidString as NSString).utf8String, -1, transient)
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw NotesDatabaseError.executionFailed(lastErrorMessage)
        }
    }

    public func deleteNote(id: UUID) throws {
        try queue.sync { try _deleteNote(id: id) }
    }

    private func _deleteNote(id: UUID) throws {
        let sql = "DELETE FROM notes WHERE id=?"
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw NotesDatabaseError.prepareFailed(lastErrorMessage)
        }
        sqlite3_bind_text(stmt, 1, (id.uuidString as NSString).utf8String, -1, NotesDatabaseManager.sqliteTransient)
        guard sqlite3_step(stmt) == SQLITE_DONE else {
            throw NotesDatabaseError.executionFailed(lastErrorMessage)
        }
    }

    /// All notes, pinned first then most-recently-modified.
    public func fetchAllNotes() throws -> [Note] {
        try queue.sync { try _fetchAllNotes() }
    }

    private func _fetchAllNotes() throws -> [Note] {
        let sql = """
        SELECT id, title, content, created_date, modified_date, is_pinned
        FROM notes
        ORDER BY is_pinned DESC, modified_date DESC
    """
        var stmt: OpaquePointer?
        defer { sqlite3_finalize(stmt) }
        guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
            throw NotesDatabaseError.prepareFailed(lastErrorMessage)
        }
        var notes: [Note] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard
                let idCStr = sqlite3_column_text(stmt, 0),
                let titleCStr = sqlite3_column_text(stmt, 1),
                let contentCStr = sqlite3_column_text(stmt, 2),
                let createdCStr = sqlite3_column_text(stmt, 3),
                let modifiedCStr = sqlite3_column_text(stmt, 4),
                let uuid = UUID(uuidString: String(cString: idCStr))
            else { continue }
            let createdRaw = String(cString: createdCStr)
            let modifiedRaw = String(cString: modifiedCStr)
            guard
                let created = NotesDatabaseManager.parseDate(createdRaw),
                let modified = NotesDatabaseManager.parseDate(modifiedRaw)
            else {
                logger.error("""
                Unparseable timestamp on note \(uuid.uuidString, privacy: .public) \
                (created=\(createdRaw, privacy: .public), modified=\(modifiedRaw, privacy: .public)) — skipping
                """)
                continue
            }
            notes.append(Note(
                id: uuid,
                title: String(cString: titleCStr),
                content: String(cString: contentCStr),
                createdDate: created,
                modifiedDate: modified,
                isPinned: sqlite3_column_int(stmt, 5) != 0
            ))
        }
        return notes
    }
}

// MARK: - Errors

public enum NotesDatabaseError: Error, LocalizedError {
    case openFailed(String)
    case prepareFailed(String)
    case executionFailed(String)

    public var errorDescription: String? {
        switch self {
        case .openFailed(let message):      return "Failed to open notes database: \(message)"
        case .prepareFailed(let message):   return "Failed to prepare notes statement: \(message)"
        case .executionFailed(let message): return "Failed to execute notes statement: \(message)"
        }
    }
}

extension NotesDatabaseManager: Loggable {
    public static nonisolated let logger = makeLogger()
}

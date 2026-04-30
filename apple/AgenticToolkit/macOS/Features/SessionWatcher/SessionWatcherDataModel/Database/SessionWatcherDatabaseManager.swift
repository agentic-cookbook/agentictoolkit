import Foundation
import SQLite3
import AgenticToolkitCore
import os

extension SessionWatcher {
    /// Manages the SQLite database connection and provides CRUD operations for all tables.
    public class SessionWatcherDatabaseManager {

        // MARK: - Properties

        private var database: OpaquePointer?
        private var dbPath: String?
        private let queue = DispatchQueue(label: "com.mikefullerton.whippet.database", qos: .userInitiated)

        /// The current schema version. Increment this when adding new migrations.
        public static let currentSchemaVersion = 4

        // MARK: - Initialization

        /// Creates a SessionWatcherDatabaseManager with the database at the specified path.
        /// If no path is given, uses the default Application Support location.
        public init() {
        }

        public func open(path: String? = nil) throws {
            if let path = path {
                self.dbPath = path
            } else {
                self.dbPath = try SessionWatcherDatabaseManager.defaultDatabasePath()
            }
            try openDatabase()
            try runMigrations()
            logger.info("Database ready at \(self.dbPath ?? "none")")
        }

        deinit {
            close()
        }

        // MARK: - Database Path

        /// Returns the default database path: ~/Library/Application Support/Whippet/whippet.db
        static public func defaultDatabasePath() throws -> String {
            let appSupport = FileManager.default.urls(
                for: .applicationSupportDirectory,
                in: .userDomainMask
            ).first!
            let whippetDir = appSupport.appendingPathComponent("Whippet")

            try FileManager.default.createDirectory(
                at: whippetDir,
                withIntermediateDirectories: true
            )

            return whippetDir.appendingPathComponent("whippet.db").path
        }

        // MARK: - Connection

        private func openDatabase() throws {
            logger.debug("Opening database at \(self.dbPath ?? "nil")")
            // Use FULLMUTEX (serialized mode) so SQLite handles thread-safety internally.
            // This allows concurrent access from the summarizer, liveness monitor, and ingestion.
            let result = sqlite3_open_v2(
                dbPath, &database,
                SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE | SQLITE_OPEN_FULLMUTEX,
                nil
            )
            guard result == SQLITE_OK else {
                let message = String(cString: sqlite3_errmsg(database))
                logger.error("Failed to open database: \(message, privacy: .public)")
                throw SessionWatcherDatabaseError.openFailed(message)
            }

            // Enable WAL mode for better concurrent read performance
            try execute("PRAGMA journal_mode=WAL")
            // Enable foreign keys
            try execute("PRAGMA foreign_keys=ON")
            logger.debug("Database opened — WAL mode, serialized threading")
        }

        public func close() {
            if let database = database {
                sqlite3_close(database)
                self.database = nil
                logger.info("Database connection closed")
            }
        }

        // MARK: - Migrations

        private func runMigrations() throws {
            // Create the migrations tracking table if it doesn't exist
            try execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)

            let currentVersion = try schemaVersion()
            logger.debug("Current schema version: \(currentVersion)")

            if currentVersion < 1 {
                logger.info("Running migration 001: create tables")
                try migration001_createTables()
                logger.info("Migration 001 complete")
            }

            if currentVersion < 2 {
                logger.info("Running migration 002: add session metadata")
                try migration002_addSessionMetadata()
                logger.info("Migration 002 complete")
            }

            if currentVersion < 3 {
                logger.info("Running migration 003: add process info")
                try migration003_addProcessInfo()
                logger.info("Migration 003 complete")
            }

            if currentVersion < 4 {
                logger.info("Running migration 004: add notes table")
                try migration004_addNotes()
                logger.info("Migration 004 complete")
            }
        }

        private func schemaVersion() throws -> Int {
            let sql = "SELECT COALESCE(MAX(version), 0) FROM schema_migrations"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            guard sqlite3_step(stmt) == SQLITE_ROW else {
                return 0
            }

            return Int(sqlite3_column_int(stmt, 0))
        }

        private func migration001_createTables() throws {
            try execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL UNIQUE,
                cwd TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT '',
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_tool TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'stale', 'ended'))
            )
        """)

            try execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id)
        """)

            try execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)
        """)

            try execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                timestamp TEXT NOT NULL DEFAULT (datetime('now')),
                raw_json TEXT NOT NULL DEFAULT '{}',
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        """)

            try execute("""
            CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id)
        """)

            try execute("""
            CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type)
        """)

            try execute("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)

            try execute("INSERT INTO schema_migrations (version) VALUES (1)")
        }

        private func migration002_addSessionMetadata() throws {
            try execute("ALTER TABLE sessions ADD COLUMN git_branch TEXT NOT NULL DEFAULT ''")
            try execute("ALTER TABLE sessions ADD COLUMN summary TEXT NOT NULL DEFAULT ''")
            try execute("INSERT INTO schema_migrations (version) VALUES (2)")
        }

        private func migration003_addProcessInfo() throws {
            try execute("ALTER TABLE sessions ADD COLUMN pid INTEGER NOT NULL DEFAULT 0")
            try execute("ALTER TABLE sessions ADD COLUMN term_program TEXT NOT NULL DEFAULT ''")
            try execute("INSERT INTO schema_migrations (version) VALUES (3)")
        }

        private func migration004_addNotes() throws {
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
            try execute("INSERT INTO schema_migrations (version) VALUES (4)")
        }

        // MARK: - SQL Helpers

        private var lastErrorMessage: String {
            if let database = database {
                return String(cString: sqlite3_errmsg(database))
            }
            return "Database not open"
        }

        @discardableResult
        public func execute(_ sql: String) throws -> Int32 {
            var errorMessage: UnsafeMutablePointer<CChar>?
            let result = sqlite3_exec(database, sql, nil, nil, &errorMessage)
            if result != SQLITE_OK {
                let message = errorMessage.map { String(cString: $0) } ?? "Unknown error"
                sqlite3_free(errorMessage)
                logger.error("SQL execution failed: \(message, privacy: .public)")
                throw SessionWatcherDatabaseError.executionFailed(message)
            }
            return result
        }

        // MARK: - SessionWatcherSession CRUD

        /// Inserts a new session or updates an existing one (upsert). Thread-safe.
        @discardableResult
        public func upsertSession(_ session: SessionWatcherSession) throws -> SessionWatcherSession {
            try queue.sync {
                try _upsertSession(session)
            }
        }

        private func _upsertSession(_ session: SessionWatcherSession) throws -> SessionWatcherSession {
            let sql = """
            INSERT INTO sessions (
                session_id, cwd, model, started_at, last_activity_at,
                last_tool, status, git_branch, summary, pid, term_program
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                cwd = CASE WHEN excluded.cwd != '' THEN excluded.cwd
                    ELSE sessions.cwd END,
                model = CASE WHEN excluded.model != '' THEN excluded.model
                    ELSE sessions.model END,
                last_activity_at = excluded.last_activity_at,
                last_tool = CASE WHEN excluded.last_tool != '' THEN excluded.last_tool
                    ELSE sessions.last_tool END,
                status = excluded.status,
                git_branch = CASE WHEN excluded.git_branch != '' THEN excluded.git_branch
                    ELSE sessions.git_branch END,
                summary = CASE WHEN excluded.summary != '' THEN excluded.summary
                    ELSE sessions.summary END,
                pid = CASE WHEN excluded.pid != 0 THEN excluded.pid
                    ELSE sessions.pid END,
                term_program = CASE WHEN excluded.term_program != '' THEN excluded.term_program
                    ELSE sessions.term_program END
        """

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            sqlite3_bind_text(stmt, 1, (session.sessionId as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (session.cwd as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 3, (session.model as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 4, (session.startedAt as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 5, (session.lastActivityAt as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 6, (session.lastTool as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 7, (session.status.rawValue as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 8, (session.gitBranch as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 9, (session.summary as NSString).utf8String, -1, nil)
            sqlite3_bind_int(stmt, 10, session.pid)
            sqlite3_bind_text(stmt, 11, (session.termProgram as NSString).utf8String, -1, nil)

            guard sqlite3_step(stmt) == SQLITE_DONE else {
                logger.error(
                    "Upsert session failed for \(session.sessionId, privacy: .public): " +
                    "\(self.lastErrorMessage, privacy: .public)"
                )
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }

            logger.debug(
                "Upserted session \(session.sessionId, privacy: .public) " +
                "status=\(session.status.rawValue, privacy: .public)"
            )

            // Return the session with its database ID
            if let fetched = try _fetchSession(bySessionId: session.sessionId) {
                return fetched
            }
            return session
        }

        /// Fetches a session by its unique session_id string. Thread-safe.
        public func fetchSession(bySessionId sessionId: String) throws -> SessionWatcherSession? {
            try queue.sync {
                try _fetchSession(bySessionId: sessionId)
            }
        }

        private func _fetchSession(bySessionId sessionId: String) throws -> SessionWatcherSession? {
            let sql = """
                SELECT id, session_id, cwd, model, started_at, last_activity_at,
                       last_tool, status, git_branch, summary, pid, term_program
                FROM sessions WHERE session_id = ?
                """

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            sqlite3_bind_text(stmt, 1, (sessionId as NSString).utf8String, -1, nil)

            guard sqlite3_step(stmt) == SQLITE_ROW else {
                return nil
            }

            return sessionFromRow(stmt)
        }

        /// Fetches all sessions, optionally filtered by status. Thread-safe.
        public func fetchAllSessions(status: SessionWatcherStatus? = nil) throws -> [SessionWatcherSession] {
            try queue.sync {
                var stmt: OpaquePointer?
                defer { sqlite3_finalize(stmt) }

                if let status = status {
                    let sql = """
                        SELECT id, session_id, cwd, model, started_at, last_activity_at,
                               last_tool, status, git_branch, summary, pid, term_program
                        FROM sessions WHERE status = ? ORDER BY started_at ASC
                        """

                    guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                        throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
                    }

                    sqlite3_bind_text(stmt, 1, (status.rawValue as NSString).utf8String, -1, nil)
                } else {
                    let sql = """
                        SELECT id, session_id, cwd, model, started_at, last_activity_at,
                               last_tool, status, git_branch, summary, pid, term_program
                        FROM sessions ORDER BY started_at ASC
                        """

                    guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                        throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
                    }
                }

                var sessions: [SessionWatcherSession] = []
                while sqlite3_step(stmt) == SQLITE_ROW {
                    sessions.append(sessionFromRow(stmt))
                }
                return sessions
            }
        }

        /// Updates the status of a session.
        public func updateSessionStatus(sessionId: String, status: SessionWatcherStatus) throws {
            logger.debug(
                "Updating session \(sessionId, privacy: .public) → " +
                "\(status.rawValue, privacy: .public)"
            )
            let sql = """
                UPDATE sessions SET status = ?, last_activity_at = datetime('now')
                WHERE session_id = ?
                """

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            sqlite3_bind_text(stmt, 1, (status.rawValue as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (sessionId as NSString).utf8String, -1, nil)

            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
        }

        /// Updates the summary of a session.
        public func updateSessionSummary(sessionId: String, summary: String) throws {
            let sql = "UPDATE sessions SET summary = ? WHERE session_id = ?"

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            sqlite3_bind_text(stmt, 1, (summary as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (sessionId as NSString).utf8String, -1, nil)

            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
        }

        /// Updates the git branch of a session.
        public func updateSessionGitBranch(sessionId: String, gitBranch: String) throws {
            let sql = "UPDATE sessions SET git_branch = ? WHERE session_id = ?"

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            sqlite3_bind_text(stmt, 1, (gitBranch as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (sessionId as NSString).utf8String, -1, nil)

            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
        }

        /// Deletes a session and all its associated events.
        public func deleteSession(sessionId: String) throws {
            logger.info("Deleting session \(sessionId, privacy: .public) and its events")
            // Delete events first (foreign key dependency)
            let deleteEventsSql = "DELETE FROM events WHERE session_id = ?"
            var evtStmt: OpaquePointer?
            defer { sqlite3_finalize(evtStmt) }
            guard sqlite3_prepare_v2(database, deleteEventsSql, -1, &evtStmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }
            sqlite3_bind_text(
                evtStmt, 1, (sessionId as NSString).utf8String, -1,
                unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            )
            guard sqlite3_step(evtStmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }

            // Then delete the session
            let deleteSessionSql = "DELETE FROM sessions WHERE session_id = ?"
            var sessStmt: OpaquePointer?
            defer { sqlite3_finalize(sessStmt) }
            guard sqlite3_prepare_v2(database, deleteSessionSql, -1, &sessStmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }
            sqlite3_bind_text(
                sessStmt, 1, (sessionId as NSString).utf8String, -1,
                unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            )
            guard sqlite3_step(sessStmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
        }

        /// Fetches active sessions that are past the given timeout (about to be marked stale).
        /// Used by the liveness monitor to know which sessions will transition to stale.
        public func fetchActiveSessionsPastTimeout(_ seconds: TimeInterval) throws -> [SessionWatcherSession] {
            let sql = """
            SELECT id, session_id, cwd, model, started_at, last_activity_at,
                   last_tool, status, git_branch, summary, pid, term_program
            FROM sessions
            WHERE status = 'active'
            AND datetime(last_activity_at, '+' || ? || ' seconds') < datetime('now')
        """

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            let secondsStr = String(max(0, Int(seconds)))
            sqlite3_bind_text(
                stmt, 1, (secondsStr as NSString).utf8String, -1,
                unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            )

            var sessions: [SessionWatcherSession] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                sessions.append(sessionFromRow(stmt))
            }
            return sessions
        }

        /// Fetches active or stale sessions that have a known PID (pid > 0).
        /// Used by the liveness monitor to check if the originating process is still alive.
        public func fetchLiveSessionsWithPid() throws -> [SessionWatcherSession] {
            let sql = """
            SELECT id, session_id, cwd, model, started_at, last_activity_at,
                   last_tool, status, git_branch, summary, pid, term_program
            FROM sessions
            WHERE status IN ('active', 'stale')
            AND pid > 0
        """

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            var sessions: [SessionWatcherSession] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                sessions.append(sessionFromRow(stmt))
            }
            return sessions
        }

        /// Marks sessions as stale if they have no activity within the given timeout interval.
        public func markStaleSessions(olderThan seconds: TimeInterval) throws -> Int {
            let sql = """
            UPDATE sessions SET status = 'stale'
            WHERE status = 'active'
            AND datetime(last_activity_at, '+' || ? || ' seconds') < datetime('now')
        """

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            let secondsStr = String(max(0, Int(seconds)))
            sqlite3_bind_text(
                stmt, 1, (secondsStr as NSString).utf8String, -1,
                unsafeBitCast(-1, to: sqlite3_destructor_type.self)
            )

            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
            let count = Int(sqlite3_changes(database))
            if count > 0 {
                logger.debug("Marked \(count) session(s) as stale (timeout: \(Int(seconds))s)")
            }
            return count
        }

        private func sessionFromRow(_ stmt: OpaquePointer?) -> SessionWatcherSession {
            SessionWatcherSession(
                id: Int(sqlite3_column_int64(stmt, 0)),
                sessionId: String(cString: sqlite3_column_text(stmt, 1)),
                cwd: String(cString: sqlite3_column_text(stmt, 2)),
                model: String(cString: sqlite3_column_text(stmt, 3)),
                startedAt: String(cString: sqlite3_column_text(stmt, 4)),
                lastActivityAt: String(cString: sqlite3_column_text(stmt, 5)),
                lastTool: String(cString: sqlite3_column_text(stmt, 6)),
                status: SessionWatcherStatus(rawValue: String(cString: sqlite3_column_text(stmt, 7))) ?? .active,
                gitBranch: String(cString: sqlite3_column_text(stmt, 8)),
                summary: String(cString: sqlite3_column_text(stmt, 9)),
                pid: sqlite3_column_int(stmt, 10),
                termProgram: String(cString: sqlite3_column_text(stmt, 11))
            )
        }

        // MARK: - Event CRUD

        /// Inserts a new event.
        @discardableResult
        public func insertEvent(_ event: SessionWatcherEvent) throws -> SessionWatcherEvent {
            let sql = """
            INSERT INTO events (session_id, event_type, timestamp, raw_json)
            VALUES (?, ?, ?, ?)
        """

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            sqlite3_bind_text(stmt, 1, (event.sessionId as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 2, (event.eventType as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 3, (event.timestamp as NSString).utf8String, -1, nil)
            sqlite3_bind_text(stmt, 4, (event.rawJson as NSString).utf8String, -1, nil)

            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }

            let lastId = Int(sqlite3_last_insert_rowid(database))
            return SessionWatcherEvent(
                id: lastId,
                sessionId: event.sessionId,
                eventType: event.eventType,
                timestamp: event.timestamp,
                rawJson: event.rawJson
            )
        }

        /// Fetches events for a given session. Thread-safe.
        public func fetchEvents(forSessionId sessionId: String) throws -> [SessionWatcherEvent] {
            try queue.sync {
                let sql = """
                    SELECT id, session_id, event_type, timestamp, raw_json FROM events
                    WHERE session_id = ? ORDER BY timestamp ASC
                    """

                var stmt: OpaquePointer?
                defer { sqlite3_finalize(stmt) }

                guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                    throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
                }

                sqlite3_bind_text(stmt, 1, (sessionId as NSString).utf8String, -1, nil)

                var events: [SessionWatcherEvent] = []
                while sqlite3_step(stmt) == SQLITE_ROW {
                    events.append(eventFromRow(stmt))
                }
                return events
            }
        }

        /// Fetches all events, optionally filtered by event type.
        public func fetchAllEvents(eventType: String? = nil) throws -> [SessionWatcherEvent] {
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            if let eventType = eventType {
                let sql = """
                    SELECT id, session_id, event_type, timestamp, raw_json FROM events
                    WHERE event_type = ? ORDER BY timestamp DESC
                    """

                guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                    throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
                }

                sqlite3_bind_text(stmt, 1, (eventType as NSString).utf8String, -1, nil)
            } else {
                let sql = "SELECT id, session_id, event_type, timestamp, raw_json FROM events ORDER BY timestamp DESC"

                guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                    throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
                }
            }

            var events: [SessionWatcherEvent] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                events.append(eventFromRow(stmt))
            }
            return events
        }

        /// Deletes events for a given session.
        public func deleteEvents(forSessionId sessionId: String) throws {
            let sql = "DELETE FROM events WHERE session_id = ?"

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            sqlite3_bind_text(stmt, 1, (sessionId as NSString).utf8String, -1, nil)

            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
        }

        private func eventFromRow(_ stmt: OpaquePointer?) -> SessionWatcherEvent {
            SessionWatcherEvent(
                id: Int(sqlite3_column_int64(stmt, 0)),
                sessionId: String(cString: sqlite3_column_text(stmt, 1)),
                eventType: String(cString: sqlite3_column_text(stmt, 2)),
                timestamp: String(cString: sqlite3_column_text(stmt, 3)),
                rawJson: String(cString: sqlite3_column_text(stmt, 4))
            )
        }

        // MARK: - Settings CRUD

        /// Gets a setting value by key. Thread-safe.
        public func getSetting(key: String) throws -> String? {
            try queue.sync {
                let sql = "SELECT value FROM settings WHERE key = ?"

                var stmt: OpaquePointer?
                defer { sqlite3_finalize(stmt) }

                guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                    throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
                }

                sqlite3_bind_text(stmt, 1, (key as NSString).utf8String, -1, nil)

                guard sqlite3_step(stmt) == SQLITE_ROW else {
                    return nil
                }

                return String(cString: sqlite3_column_text(stmt, 0))
            }
        }

        /// Sets a setting value (insert or update). Thread-safe.
        public func setSetting(key: String, value: String) throws {
            try queue.sync {
                let sql = """
                INSERT INTO settings (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """

                var stmt: OpaquePointer?
                defer { sqlite3_finalize(stmt) }

                guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                    throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
                }

                sqlite3_bind_text(stmt, 1, (key as NSString).utf8String, -1, nil)
                sqlite3_bind_text(stmt, 2, (value as NSString).utf8String, -1, nil)

                guard sqlite3_step(stmt) == SQLITE_DONE else {
                    throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
                }
            }
        }

        /// Deletes a setting by key.
        public func deleteSetting(key: String) throws {
            let sql = "DELETE FROM settings WHERE key = ?"

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            sqlite3_bind_text(stmt, 1, (key as NSString).utf8String, -1, nil)

            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
        }

        /// Fetches all settings as a dictionary.
        public func fetchAllSettings() throws -> [String: String] {
            let sql = "SELECT key, value FROM settings ORDER BY key"

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            var settings: [String: String] = [:]
            while sqlite3_step(stmt) == SQLITE_ROW {
                let key = String(cString: sqlite3_column_text(stmt, 0))
                let value = String(cString: sqlite3_column_text(stmt, 1))
                settings[key] = value
            }
            return settings
        }

        // MARK: - Schema Inspection (for testing)

        /// Returns the names of all tables in the database.
        public func tableNames() throws -> [String] {
            let sql = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            var names: [String] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                names.append(String(cString: sqlite3_column_text(stmt, 0)))
            }
            return names
        }

        /// Returns column info for a given table.
        public func columnInfo(forTable table: String) throws -> [(name: String, type: String, notNull: Bool)] {
            // Validate table name: only allow alphanumeric and underscore to prevent injection
            guard table.allSatisfy({ $0.isLetter || $0.isNumber || $0 == "_" }) else {
                throw SessionWatcherDatabaseError.prepareFailed("Invalid table name: \(table)")
            }
            let sql = "PRAGMA table_info(\(table))"

            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }

            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }

            var columns: [(name: String, type: String, notNull: Bool)] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                let name = String(cString: sqlite3_column_text(stmt, 1))
                let type = String(cString: sqlite3_column_text(stmt, 2))
                let notNull = sqlite3_column_int(stmt, 3) != 0
                columns.append((name: name, type: type, notNull: notNull))
            }
            return columns
        }

        /// Exposes the current schema version for testing purposes only.
        public func currentSchemaVersionForTesting() throws -> Int {
            try schemaVersion()
        }

        // MARK: - Notes CRUD

        // SQLITE_TRANSIENT tells SQLite to copy the data immediately, avoiding dangling-pointer issues
        // when binding temporary NSString.utf8String results.
        private static let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

        nonisolated(unsafe) private static let iso8601: ISO8601DateFormatter = {
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            return formatter
        }()

        /// Inserts a new note. Thread-safe.
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
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }
            let transient = SessionWatcherDatabaseManager.sqliteTransient
            let createdString = SessionWatcherDatabaseManager.iso8601.string(from: note.createdDate)
            let modifiedString = SessionWatcherDatabaseManager.iso8601.string(from: note.modifiedDate)
            sqlite3_bind_text(stmt, 1, (note.id.uuidString as NSString).utf8String, -1, transient)
            sqlite3_bind_text(stmt, 2, (note.title as NSString).utf8String, -1, transient)
            sqlite3_bind_text(stmt, 3, (note.content as NSString).utf8String, -1, transient)
            sqlite3_bind_text(stmt, 4, (createdString as NSString).utf8String, -1, transient)
            sqlite3_bind_text(stmt, 5, (modifiedString as NSString).utf8String, -1, transient)
            sqlite3_bind_int(stmt, 6, note.isPinned ? 1 : 0)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
            logger.debug("Inserted note \(note.id.uuidString, privacy: .public)")
        }

        /// Updates title, content, modifiedDate, and isPinned for an existing note. Thread-safe.
        public func updateNote(_ note: Note) throws {
            try queue.sync { try _updateNote(note) }
        }

        private func _updateNote(_ note: Note) throws {
            let sql = "UPDATE notes SET title=?, content=?, modified_date=?, is_pinned=? WHERE id=?"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }
            let transient = SessionWatcherDatabaseManager.sqliteTransient
            let modifiedString = SessionWatcherDatabaseManager.iso8601.string(from: note.modifiedDate)
            sqlite3_bind_text(stmt, 1, (note.title as NSString).utf8String, -1, transient)
            sqlite3_bind_text(stmt, 2, (note.content as NSString).utf8String, -1, transient)
            sqlite3_bind_text(stmt, 3, (modifiedString as NSString).utf8String, -1, transient)
            sqlite3_bind_int(stmt, 4, note.isPinned ? 1 : 0)
            sqlite3_bind_text(stmt, 5, (note.id.uuidString as NSString).utf8String, -1, transient)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
            logger.debug("Updated note \(note.id.uuidString, privacy: .public)")
        }

        /// Deletes a note by UUID. Thread-safe.
        public func deleteNote(id: UUID) throws {
            try queue.sync { try _deleteNote(id: id) }
        }

        private func _deleteNote(id: UUID) throws {
            let sql = "DELETE FROM notes WHERE id=?"
            var stmt: OpaquePointer?
            defer { sqlite3_finalize(stmt) }
            guard sqlite3_prepare_v2(database, sql, -1, &stmt, nil) == SQLITE_OK else {
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }
            let transient = SessionWatcherDatabaseManager.sqliteTransient
            sqlite3_bind_text(stmt, 1, (id.uuidString as NSString).utf8String, -1, transient)
            guard sqlite3_step(stmt) == SQLITE_DONE else {
                throw SessionWatcherDatabaseError.executionFailed(lastErrorMessage)
            }
            logger.debug("Deleted note \(id.uuidString, privacy: .public)")
        }

        /// Returns all notes sorted pinned-first, then by modifiedDate descending. Thread-safe.
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
                throw SessionWatcherDatabaseError.prepareFailed(lastErrorMessage)
            }
            var notes: [Note] = []
            while sqlite3_step(stmt) == SQLITE_ROW {
                guard
                    let idCStr = sqlite3_column_text(stmt, 0),
                    let titleCStr = sqlite3_column_text(stmt, 1),
                    let contentCStr = sqlite3_column_text(stmt, 2),
                    let createdCStr = sqlite3_column_text(stmt, 3),
                    let modifiedCStr = sqlite3_column_text(stmt, 4)
                else { continue }
                let idStr = String(cString: idCStr)
                guard let uuid = UUID(uuidString: idStr) else { continue }
                let created = SessionWatcherDatabaseManager.iso8601.date(from: String(cString: createdCStr)) ?? Date()
                let modified = SessionWatcherDatabaseManager.iso8601.date(from: String(cString: modifiedCStr)) ?? Date()
                notes.append(Note(
                    id: uuid,
                    title: String(cString: titleCStr),
                    content: String(cString: contentCStr),
                    createdDate: created,
                    modifiedDate: modified,
                    isPinned: sqlite3_column_int(stmt, 5) != 0
                ))
            }
            logger.debug("Fetched \(notes.count) notes")
            return notes
        }
    }
}
// MARK: - NoteStorage Conformance

/// SessionWatcherDatabaseManager already implements the NoteStorage methods —
/// this declares conformance so it can be injected into NotesManager.
extension SessionWatcher.SessionWatcherDatabaseManager: NoteStorage {}

extension SessionWatcher.SessionWatcherDatabaseManager: Loggable {
    public static nonisolated let logger = makeLogger()
}

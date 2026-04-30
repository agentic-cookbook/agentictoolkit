import Foundation

extension SessionWatcher {
    // MARK: - SessionWatcherSession

    /// Represents a Claude Code session being monitored.
    public struct SessionWatcherSession: Equatable, Sendable {
        public var id: Int?
        public var sessionId: String
        public var cwd: String
        public var model: String
        public var startedAt: String
        public var lastActivityAt: String
        public var lastTool: String
        public var status: SessionWatcherStatus
        public var gitBranch: String
        public var summary: String
        public var pid: Int32
        public var termProgram: String

        public init(
            id: Int? = nil,
            sessionId: String,
            cwd: String = "",
            model: String = "",
            startedAt: String = "",
            lastActivityAt: String = "",
            lastTool: String = "",
            status: SessionWatcherStatus = .active,
            gitBranch: String = "",
            summary: String = "",
            pid: Int32 = 0,
            termProgram: String = ""
        ) {
            self.id = id
            self.sessionId = sessionId
            self.cwd = cwd
            self.model = model
            self.startedAt = startedAt.isEmpty ? ISO8601DateFormatter().string(from: Date()) : startedAt
            self.lastActivityAt = lastActivityAt.isEmpty ? ISO8601DateFormatter().string(from: Date()) : lastActivityAt
            self.lastTool = lastTool
            self.status = status
            self.gitBranch = gitBranch
            self.summary = summary
            self.pid = pid
            self.termProgram = termProgram
        }

        /// Returns the best available description for this session.
        /// Priority: summary > gitBranch > last path component of cwd.
        public var displayLabel: String {
            if !summary.isEmpty { return summary }
            if !gitBranch.isEmpty { return gitBranch }
            guard !cwd.isEmpty, cwd != "/" else { return "Unknown" }
            return (cwd as NSString).lastPathComponent
        }

        /// Derives the project name from the last path component of the working directory.
        public var projectName: String {
            guard !cwd.isEmpty, cwd != "/" else { return "Unknown" }
            return (cwd as NSString).lastPathComponent
        }
    }

    // MARK: - SessionWatcherSession Status

    /// The lifecycle status of a session.
    public enum SessionWatcherStatus: String, CaseIterable, Sendable {
        case active
        case stale
        case ended
    }

    // MARK: - SessionWatcherSession Event

    /// Represents a single event in a Claude Code session.
    public struct SessionWatcherEvent: Equatable, Sendable {
        public var id: Int?
        public var sessionId: String
        public var eventType: String
        public var timestamp: String
        public var rawJson: String

        public init(
            id: Int? = nil,
            sessionId: String,
            eventType: String,
            timestamp: String = "",
            rawJson: String = "{}"
        ) {
            self.id = id
            self.sessionId = sessionId
            self.eventType = eventType
            self.timestamp = timestamp.isEmpty ? ISO8601DateFormatter().string(from: Date()) : timestamp
            self.rawJson = rawJson
        }
    }

    // MARK: - Database Error

    /// Errors that can occur during database operations.
    public enum SessionWatcherDatabaseError: Error, LocalizedError {
        case openFailed(String)
        case prepareFailed(String)
        case executionFailed(String)
        case migrationFailed(String)

        public var errorDescription: String? {
            switch self {
            case .openFailed(let message):
                return "Failed to open database: \(message)"
            case .prepareFailed(let message):
                return "Failed to prepare statement: \(message)"
            case .executionFailed(let message):
                return "Failed to execute statement: \(message)"
            case .migrationFailed(let message):
                return "Database migration failed: \(message)"
            }
        }
    }
}

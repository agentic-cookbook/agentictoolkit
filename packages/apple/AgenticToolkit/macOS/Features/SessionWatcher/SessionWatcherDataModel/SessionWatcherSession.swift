import Foundation

extension SessionWatcher {
    // MARK: - SessionWatcherSession

    /// A Claude Code session, as rendered by the Sessions window.
    ///
    /// This is a plain view model, not a database row: the window reaches it only
    /// through ``SessionListSource``, so where it came from — an HTTP daemon, a
    /// local store, a test fixture — is the source's business, not the window's.
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
        /// The top-level (non-submodule) git project root for `cwd`. Empty when
        /// unknown (not yet enriched, or cwd isn't a git working tree). Used to
        /// group sessions by project in the Sessions window.
        public var projectRoot: String
        /// The terminal's `TERM_SESSION_ID` (e.g. iTerm's "w0t1p0:UUID"), used to
        /// jump to the exact tab/pane on click. Empty for terminals that don't set it.
        public var termSessionId: String

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
            termProgram: String = "",
            projectRoot: String = "",
            termSessionId: String = ""
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
            self.projectRoot = projectRoot
            self.termSessionId = termSessionId
        }

        /// Returns the best available description for this session.
        /// Priority: summary > gitBranch > last path component of cwd.
        public var displayLabel: String {
            if !summary.isEmpty { return summary }
            if !gitBranch.isEmpty { return gitBranch }
            guard !cwd.isEmpty, cwd != "/" else { return "Unknown" }
            return (cwd as NSString).lastPathComponent
        }

        /// The last path component of the **working directory**.
        ///
        /// Use this for terminal-window-title matching (activation / liveness),
        /// where the title reflects the cwd — NOT for the Sessions-window grouping
        /// header, which uses ``projectGroupName`` (the project *root*). For a linked
        /// worktree or a submodule subdir these two differ on purpose, so don't
        /// substitute one for the other.
        public var projectName: String {
            guard !cwd.isEmpty, cwd != "/" else { return "Unknown" }
            return (cwd as NSString).lastPathComponent
        }

        /// The key the Sessions window groups by: the top-level git project root,
        /// falling back to `cwd` when the project root is unknown.
        public var projectGroupKey: String {
            projectRoot.isEmpty ? cwd : projectRoot
        }

        /// A human-readable name for the project group — the last path component
        /// of ``projectGroupKey`` (the project root). This is the Sessions-window
        /// grouping/header name; contrast ``projectName`` (cwd-based, for
        /// terminal-title matching).
        public var projectGroupName: String {
            let key = projectGroupKey
            guard !key.isEmpty, key != "/" else { return "Unknown" }
            return (key as NSString).lastPathComponent
        }
    }

    // MARK: - SessionWatcherSession Status

    /// The lifecycle status of a session.
    public enum SessionWatcherStatus: String, CaseIterable, Sendable {
        case active
        case stale
        case ended
    }
}

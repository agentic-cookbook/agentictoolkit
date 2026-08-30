import Foundation

/// A git repository the app knows about.
///
/// The identity is the `id`, not the path: a repository that moves keeps its
/// settings, its layout and its name because the row is re-pointed rather than
/// replaced. That is the whole reason the primary key is a UUID and not the
/// path (`optimize-for-change`).
public struct GitRepo: Sendable, Identifiable, Equatable {

    public let id: UUID
    /// Absolute path to the working tree.
    public var path: String
    /// What to call it. Seeded from the directory name, then the user's to change.
    public var name: String
    /// `origin`'s URL, or `nil` for a repository with no remote.
    public var remote: String?
    public var firstSeen: Date
    public var lastSeen: Date
    /// When a project window was last opened for it — what the browser sorts by.
    public var lastOpened: Date?
    /// Set when a scan no longer finds the path. The row is kept rather than
    /// deleted: an unmounted volume or a temporarily renamed folder must not
    /// take the project's settings with it.
    public var missingSince: Date?

    public init(
        id: UUID = UUID(),
        path: String,
        name: String,
        remote: String? = nil,
        firstSeen: Date = Date(),
        lastSeen: Date = Date(),
        lastOpened: Date? = nil,
        missingSince: Date? = nil
    ) {
        self.id = id
        self.path = path
        self.name = name
        self.remote = remote
        self.firstSeen = firstSeen
        self.lastSeen = lastSeen
        self.lastOpened = lastOpened
        self.missingSince = missingSince
    }

    public var url: URL { URL(fileURLWithPath: path) }

    public var isMissing: Bool { missingSince != nil }

    /// The default name for a repository at `path` — its directory name.
    public static func defaultName(forPath path: String) -> String {
        URL(fileURLWithPath: path).lastPathComponent
    }
}

/// One repository as the scanner found it on disk. Deliberately not a
/// `GitRepo`: a scan result has no identity yet — deciding whether it is a new
/// repository, a moved one, or one already known is the reconciler's job.
public struct ScannedGitRepo: Sendable, Equatable {
    public let path: String
    public let remote: String?

    public init(path: String, remote: String?) {
        self.path = path
        self.remote = remote
    }

    public var leafName: String { URL(fileURLWithPath: path).lastPathComponent }
}

/// What a scan changed, for the log line and the progress window's last word.
public struct ProjectScanSummary: Sendable, Equatable {
    public var added: Int = 0
    public var moved: Int = 0
    public var missing: Int = 0
    public var restored: Int = 0
    public var unchanged: Int = 0

    public init() {}

    public var total: Int { added + moved + missing + restored + unchanged }

    /// One line for the log, and for the progress window before it closes.
    public var summaryText: String {
        var parts: [String] = []
        if added > 0 { parts.append("\(added) new") }
        if moved > 0 { parts.append("\(moved) moved") }
        if missing > 0 { parts.append("\(missing) missing") }
        if restored > 0 { parts.append("\(restored) restored") }
        if parts.isEmpty { return "\(total) projects, no changes" }
        return "\(total) projects — " + parts.joined(separator: ", ")
    }
}

import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import os

/// One open project: the repository it is, the database rows that belong to
/// it, and the tab/split arrangement its window shows.
///
/// This is what `NSDocument` used to be here, minus the document. There is no
/// file to read, write, autosave, revert or name — a project is a `git_repo`
/// row plus the rows keyed to it, so every edit is already saved and a
/// repository can move on disk without the project noticing.
@MainActor
public final class ProjectWorkspace {

    public private(set) var repo: GitRepo
    public let database: ProjectDatabase

    /// The views this project may show and the arrangements it may show them
    /// in. Defaults to whatever the app installed; a host can hand a different
    /// one to the projects it opens (`dependency-injection`).
    public var layout: ComposableTabsLayout

    private var nextPaneNumber = 1

    public init(
        repo: GitRepo,
        database: ProjectDatabase,
        layout: ComposableTabsLayout? = nil
    ) {
        self.repo = repo
        self.database = database
        self.layout = layout ?? ComposableTabsLayout.current ?? ComposableTabsLayout.placeholderOnly()
    }

    public var id: UUID { repo.id }
    public var displayName: String { repo.name }
    /// The repository's own folder — the root every pane defaults to.
    public var directoryURL: URL { repo.url }

    /// Where panes may write derived data for this project — file-tree scan
    /// caches and the like.
    ///
    /// Beside the database, not inside the repository: a project owns no files
    /// in the folder it is about, so nothing it caches can show up in the
    /// user's diff or have to be excluded from its own file tree.
    public var cacheDirectoryURL: URL {
        let url = URL(fileURLWithPath: database.databasePath)
            .deletingLastPathComponent()
            .appendingPathComponent("caches", isDirectory: true)
            .appendingPathComponent(repo.id.uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        return url
    }

    /// Picks up a rename or a move without rebuilding the window.
    public func update(repo: GitRepo) {
        guard repo.id == self.repo.id else { return }
        self.repo = repo
    }

    public func allocatePaneNumber() -> Int {
        let allocated = nextPaneNumber
        nextPaneNumber += 1
        return allocated
    }

    // MARK: - Tabs

    /// The tabs the window controller should display: the stored set, or one
    /// default tab for a project being opened for the first time.
    public func initialTabs() -> (tabs: [TabRecord], activeTabID: UUID, enabledEdges: [Edge]) {
        let stored: (tabs: [TabRecord], activeTabID: UUID?, enabledEdges: [Edge]) =
            (try? database.loadTabs(repoID: repo.id)) ?? (tabs: [], activeTabID: nil, enabledEdges: [.top])
        guard !stored.tabs.isEmpty else {
            let tab = TabRecord(title: "Tab 1", root: layout.blueprint())
            return ([tab], tab.id, [.top])
        }
        // A stored tree can outlive the spec that made it, so it is repaired on
        // the way in rather than allowed to contradict the rules the split menu
        // enforces from here on.
        let repaired = stored.tabs.map { record -> TabRecord in
            var record = record
            record.root = layout.spec.reconcile(record.root)
            return record
        }
        return (repaired, stored.activeTabID ?? repaired[0].id, stored.enabledEdges)
    }

    /// Persists the current tabs, which one is active, and the enabled edges.
    /// Called whenever a tab is added/removed/reordered, an edge is toggled, or
    /// the split layout inside a tab changes.
    public func persistTabs(_ tabs: [TabRecord], activeTabID: UUID?, enabledEdges: [Edge]) {
        do {
            try database.saveTabs(tabs, activeTabID: activeTabID, enabledEdges: enabledEdges, repoID: repo.id)
        } catch {
            Self.logger.error("Failed to save project tabs: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Project directories

    /// The extra directories this project's file browser shows, beyond the
    /// repository's own folder.
    public func projectDirectories() -> [URL] {
        do {
            return try database.loadProjectDirectories(repoID: repo.id).map { URL(fileURLWithPath: $0) }
        } catch {
            Self.logger.error("Failed to load project directories: \(error.localizedDescription, privacy: .public)")
            return []
        }
    }

    /// Persists the extra directories. Called whenever the browser's `+`/`−`
    /// changes the list.
    public func persistProjectDirectories(_ urls: [URL]) {
        do {
            try database.saveProjectDirectories(urls.map(\.path), repoID: repo.id)
        } catch {
            Self.logger.error("Failed to save project directories: \(error.localizedDescription, privacy: .public)")
        }
    }
}

extension ProjectWorkspace: Loggable {
    public static nonisolated let logger = makeLogger()
}

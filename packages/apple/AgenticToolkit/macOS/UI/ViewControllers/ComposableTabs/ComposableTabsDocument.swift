import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import os

public class ComposableTabsDocument: NSDocument {

    public nonisolated static let databaseFilename = "project.sqlite"

    nonisolated(unsafe) private var _layoutStore: DocumentLayoutStore?
    nonisolated(unsafe) private var pendingTabsForLoad: [TabRecord]?
    nonisolated(unsafe) private var pendingActiveTabIDForLoad: UUID?
    nonisolated(unsafe) private var pendingEnabledEdgesForLoad: [Edge]?
    nonisolated(unsafe) private var nextPaneNumber: Int = 1
    private let stateLock = NSLock()

    public override class var autosavesInPlace: Bool { true }

    /// The views this document may show and the arrangements it may show them
    /// in. Defaults to whatever the app installed; a document controller can
    /// hand a different one to the documents it opens, which is how the demo
    /// and a real app document coexist in one process
    /// (`dependency-injection`).
    @MainActor
    public lazy var layout: ComposableTabsLayout = ComposableTabsLayout.current
        ?? ComposableTabsLayout.placeholderOnly()

    // MARK: - Thread-safe state access

    public nonisolated var layoutStore: DocumentLayoutStore? {
        stateLock.lock()
        defer { stateLock.unlock() }
        return _layoutStore
    }

    private nonisolated func setLayoutStore(_ store: DocumentLayoutStore?) {
        stateLock.lock()
        _layoutStore = store
        stateLock.unlock()
    }

    private nonisolated func setPendingTabs(_ tabs: [TabRecord]?, activeTabID: UUID?, enabledEdges: [Edge]?) {
        stateLock.lock()
        pendingTabsForLoad = tabs
        pendingActiveTabIDForLoad = activeTabID
        pendingEnabledEdgesForLoad = enabledEdges
        stateLock.unlock()
    }

    @MainActor
    public func allocatePaneNumber() -> Int {
        stateLock.lock()
        let allocated = nextPaneNumber
        nextPaneNumber += 1
        stateLock.unlock()
        return allocated
    }

    /// Returns the tabs the window controller should display: either the
    /// freshly-loaded set (after `read(from:)`) or a single default tab
    /// for new documents.
    @MainActor
    public func initialTabs() -> (tabs: [TabRecord], activeTabID: UUID, enabledEdges: [Edge]) {
        stateLock.lock()
        let pending = pendingTabsForLoad
        let pendingActive = pendingActiveTabIDForLoad
        let pendingEdges = pendingEnabledEdgesForLoad
        stateLock.unlock()
        if let pending, !pending.isEmpty {
            let active = pendingActive ?? pending[0].id
            // A stored tree can outlive the spec that made it, so it is
            // repaired on the way in rather than allowed to contradict the
            // rules the split menu enforces from here on.
            let repaired = pending.map { record -> TabRecord in
                var record = record
                record.root = layout.spec.reconcile(record.root)
                return record
            }
            return (repaired, active, pendingEdges ?? [.top])
        }
        let tab = TabRecord(title: "Tab 1", root: layout.blueprint())
        return ([tab], tab.id, [.top])
    }

    /// Persist the current set of tabs, which one is active, and the
    /// enabled edges. Called by the window controller whenever a tab is
    /// added/removed/reordered, an edge is toggled, or split-view layout
    /// inside a tab changes.
    @MainActor
    public func persistTabs(_ tabs: [TabRecord], activeTabID: UUID?, enabledEdges: [Edge]) {
        guard let store = layoutStore else { return }
        do {
            try store.saveTabs(tabs, activeTabID: activeTabID, enabledEdges: enabledEdges)
        } catch {
            logger.error("Failed to save document tabs: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - NSDocument reading

    public override func read(from url: URL, ofType typeName: String) throws {
        let dbURL = url.appendingPathComponent(Self.databaseFilename)
        let store = try DocumentLayoutStore(path: dbURL.path)
        let loaded = try store.loadTabs()
        setLayoutStore(store)
        setPendingTabs(loaded.tabs, activeTabID: loaded.activeTabID, enabledEdges: loaded.enabledEdges)
    }

    // MARK: - NSDocument writing

    public override func write(to url: URL, ofType typeName: String) throws {
        let fileManager = FileManager.default
        if !fileManager.fileExists(atPath: url.path) {
            try fileManager.createDirectory(at: url, withIntermediateDirectories: true)
        }
        let dbURL = url.appendingPathComponent(Self.databaseFilename)

        if let existing = layoutStore, existing.databasePath == dbURL.path {
            return
        }

        if !fileManager.fileExists(atPath: dbURL.path), let source = layoutStore {
            // Flush the WAL first — copying just the main file of a live
            // WAL database would silently drop every un-checkpointed
            // commit from the duplicate.
            try source.checkpoint()
            if fileManager.fileExists(atPath: source.databasePath) {
                try fileManager.copyItem(atPath: source.databasePath, toPath: dbURL.path)
            }
        }

        let newStore = try DocumentLayoutStore(path: dbURL.path)
        let loaded = try newStore.loadTabs()
        if loaded.tabs.isEmpty {
            stateLock.lock()
            let pending = pendingTabsForLoad
            let pendingActive = pendingActiveTabIDForLoad
            let pendingEdges = pendingEnabledEdgesForLoad
            stateLock.unlock()
            // `ComposableTabsLayout.makeTabLayout()` is nonisolated and
            // lock-guarded precisely so this writer, which can run off-main,
            // seeds the same layout every other entry point does.
            let tabs = pending ?? [TabRecord(title: "Tab 1", root: ComposableTabsLayout.makeTabLayout())]
            let active = pendingActive ?? tabs.first?.id
            try newStore.saveTabs(tabs, activeTabID: active, enabledEdges: pendingEdges ?? [.top])
        }
        setLayoutStore(newStore)
    }

    public override func writeSafely(
        to url: URL,
        ofType typeName: String,
        for saveOperation: NSDocument.SaveOperationType
    ) throws {
        try write(to: url, ofType: typeName)
    }

    // MARK: - Window controllers

    @MainActor
    public override func makeWindowControllers() {
        if layoutStore == nil {
            let tmpURL = URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent("WhippetDoc-\(UUID().uuidString)")
                .appendingPathExtension("whiproj")
            try? FileManager.default.createDirectory(at: tmpURL, withIntermediateDirectories: true)
            let dbPath = tmpURL.appendingPathComponent(Self.databaseFilename).path
            if let store = try? DocumentLayoutStore(path: dbPath) {
                let tab = TabRecord(title: "Tab 1", root: layout.blueprint())
                try? store.saveTabs([tab], activeTabID: tab.id)
                setLayoutStore(store)
            }
        }
        let controller = ComposableTabsWindowController(document: self)
        addWindowController(controller)
    }
}

extension ComposableTabsDocument: Loggable {
    public static nonisolated let logger = makeLogger()
}

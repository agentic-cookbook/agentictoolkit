import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import os


public class NestedSplitViewDocument: NSDocument {

    public nonisolated static let databaseFilename = "project.sqlite"

    nonisolated(unsafe) private var _layoutStore: DocumentLayoutStore?
    nonisolated(unsafe) private var pendingTabsForLoad: [TabRecord]?
    nonisolated(unsafe) private var pendingActiveTabIDForLoad: UUID?
    nonisolated(unsafe) private var nextPaneNumber: Int = 1
    private let stateLock = NSLock()

    public override class var autosavesInPlace: Bool { true }

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

    private nonisolated func setPendingTabs(_ tabs: [TabRecord]?, activeTabID: UUID?) {
        stateLock.lock()
        pendingTabsForLoad = tabs
        pendingActiveTabIDForLoad = activeTabID
        stateLock.unlock()
    }

    @MainActor
    public func allocatePaneNumber() -> Int {
        stateLock.lock()
        let n = nextPaneNumber
        nextPaneNumber += 1
        stateLock.unlock()
        return n
    }

    /// Returns the tabs the window controller should display: either the
    /// freshly-loaded set (after `read(from:)`) or a single default tab
    /// for new documents.
    @MainActor
    public func initialTabs() -> (tabs: [TabRecord], activeTabID: UUID) {
        stateLock.lock()
        let pending = pendingTabsForLoad
        let pendingActive = pendingActiveTabIDForLoad
        stateLock.unlock()
        if let pending, !pending.isEmpty {
            let active = pendingActive ?? pending[0].id
            return (pending, active)
        }
        let tab = TabRecord(title: "Tab 1", root: defaultLayout())
        return ([tab], tab.id)
    }

    /// Persist the current set of tabs and which one is active. Called by
    /// the window controller whenever a tab is added/removed/reordered or
    /// when split-view layout inside a tab changes.
    @MainActor
    public func persistTabs(_ tabs: [TabRecord], activeTabID: UUID?) {
        guard let store = layoutStore else { return }
        do {
            try store.saveTabs(tabs, activeTabID: activeTabID)
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
        setPendingTabs(loaded.tabs, activeTabID: loaded.activeTabID)
    }

    // MARK: - NSDocument writing

    public override func write(to url: URL, ofType typeName: String) throws {
        let fm = FileManager.default
        if !fm.fileExists(atPath: url.path) {
            try fm.createDirectory(at: url, withIntermediateDirectories: true)
        }
        let dbURL = url.appendingPathComponent(Self.databaseFilename)

        if let existing = layoutStore, existing.databasePath == dbURL.path {
            return
        }

        if !fm.fileExists(atPath: dbURL.path), let source = layoutStore?.databasePath,
           fm.fileExists(atPath: source) {
            try fm.copyItem(atPath: source, toPath: dbURL.path)
        }

        let newStore = try DocumentLayoutStore(path: dbURL.path)
        let loaded = try newStore.loadTabs()
        if loaded.tabs.isEmpty {
            stateLock.lock()
            let pending = pendingTabsForLoad
            let pendingActive = pendingActiveTabIDForLoad
            stateLock.unlock()
            // `NestedContentRegistry.placeholderIdentifier` is MainActor-
            // isolated; this writer can run off-main, so use the literal.
            let tabs = pending ?? [TabRecord(title: "Tab 1", root: LayoutNode.split(
                orientation: "horizontal",
                first: LayoutNode.leaf(contentType: "placeholder"),
                second: LayoutNode.leaf(contentType: "placeholder")
            ))]
            let active = pendingActive ?? tabs.first?.id
            try newStore.saveTabs(tabs, activeTabID: active)
        }
        setLayoutStore(newStore)
    }

    public override func writeSafely(to url: URL, ofType typeName: String, for saveOperation: NSDocument.SaveOperationType) throws {
        try write(to: url, ofType: typeName)
    }

    @MainActor private func defaultLayout() -> LayoutNode {
        LayoutNode.split(
            orientation: "horizontal",
            first: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier),
            second: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier)
        )
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
                let tab = TabRecord(title: "Tab 1", root: defaultLayout())
                try? store.saveTabs([tab], activeTabID: tab.id)
                setLayoutStore(store)
            }
        }
        let wc = NestedSplitViewWindowController(document: self)
        addWindowController(wc)
    }
}

extension NestedSplitViewDocument: Loggable {
    public static nonisolated let logger = makeLogger()
}

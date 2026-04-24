import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import os


public class NestedSplitViewDocument: NSDocument {

    public nonisolated static let databaseFilename = "project.sqlite"

    nonisolated(unsafe) private var _layoutStore: DocumentLayoutStore?
    nonisolated(unsafe) private var pendingLayoutForLoad: LayoutNode?
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

    private nonisolated func setPendingLayout(_ layout: LayoutNode?) {
        stateLock.lock()
        pendingLayoutForLoad = layout
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

    @MainActor
    public func initialLayout() -> LayoutNode {
        stateLock.lock()
        let pending = pendingLayoutForLoad
        stateLock.unlock()
        if let pending { return pending }
        return LayoutNode.split(
            orientation: "horizontal",
            first: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier),
            second: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier)
        )
    }

    @MainActor
    public func persistLayout(_ root: LayoutNode) {
        guard let store = layoutStore else { return }
        do {
            try store.saveLayout(root)
        } catch {
            logger.error("Failed to save document layout: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - NSDocument reading

    public override func read(from url: URL, ofType typeName: String) throws {
        let dbURL = url.appendingPathComponent(Self.databaseFilename)
        let store = try DocumentLayoutStore(path: dbURL.path)
        let loaded = try store.loadLayout()
        setLayoutStore(store)
        setPendingLayout(loaded)
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
        if (try? newStore.loadLayout()) == nil {
            stateLock.lock()
            let pending = pendingLayoutForLoad
            stateLock.unlock()
            try newStore.saveLayout(pending ?? LayoutNode.split(orientation: "horizontal", first: LayoutNode.leaf(contentType: "placeholder"), second: LayoutNode.leaf(contentType: "placeholder")))
        }
        setLayoutStore(newStore)
    }

    public override func writeSafely(to url: URL, ofType typeName: String, for saveOperation: NSDocument.SaveOperationType) throws {
        try write(to: url, ofType: typeName)
    }

    @MainActor private func defaultInitialLayout() -> LayoutNode {
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
                try? store.saveLayout(defaultInitialLayout())
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

import AppKit
import UniformTypeIdentifiers
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import os


/// Abstracts the save/open panel modal prompts so tests can inject a fake
/// that returns a URL synchronously without spinning AppKit's modal loop.
@MainActor
public protocol ProjectURLPrompting {
    func promptForNewProjectURL() -> URL?
    func promptForExistingProjectURLs() -> [URL]
}

public final class WhippetDocumentController: NSDocumentController {

    private static let projectUTI = "com.mikefullerton.whippet.project"
    private static let projectExtension = "whiproj"

    /// Override in tests to avoid running AppKit modal panels.
    public var urlPrompter: ProjectURLPrompting = DefaultProjectURLPrompter()

    /// Whether to ask NSDocumentController to display (create a window for)
    /// opened documents. Tests set this to false because creating an NSWindow
    /// inside the xctest host trips a CUICatalog/CoreGlyphs crash on macOS 26
    /// that does not reproduce in the real app.
    public var shouldDisplayOpenedDocuments: Bool = true

    /// Signals that the most recent new/open flow has finished registering the
    /// document (or failed). Exposed for integration tests that otherwise have
    /// no way to await the async `openDocument(withContentsOf:display:)` call.
    public var didFinishOpeningDocument: ((NSDocument?, Error?) -> Void)?

    @IBAction public override func newDocument(_ sender: Any?) {
        logger.info("WhippetDocumentController.newDocument(_:) invoked")
        NSApp.activate(ignoringOtherApps: true)
        guard let url = urlPrompter.promptForNewProjectURL() else {
            logger.info("newDocument: prompter returned nil — user cancelled")
            return
        }
        createDocumentPackage(at: url)
    }

    @IBAction public override func openDocument(_ sender: Any?) {
        logger.info("WhippetDocumentController.openDocument(_:) invoked")
        NSApp.activate(ignoringOtherApps: true)
        let urls = urlPrompter.promptForExistingProjectURLs()
        guard !urls.isEmpty else {
            logger.info("openDocument: prompter returned empty — user cancelled")
            return
        }
        for url in urls {
            openProject(at: url)
        }
    }

    private func createDocumentPackage(at url: URL) {
        // User may have chosen "Replace" in the save panel for a path that is
        // already open. Close the stale in-memory document first so its
        // on-disk state is overwritten cleanly and openProject loads the
        // fresh package instead of returning the cached one.
        let prospectiveURL = url.pathExtension.lowercased() == Self.projectExtension
            ? url
            : url.appendingPathExtension(Self.projectExtension)
        if let existing = document(for: prospectiveURL) {
            existing.close()
        }

        let finalURL: URL
        do {
            finalURL = try Self.writeEmptyPackage(at: url)
        } catch {
            logger.error("Failed to create Whippet project at \(url.path, privacy: .public): \(error.localizedDescription, privacy: .public)")
            presentError(error)
            return
        }
        openProject(at: finalURL)
    }

    /// Opens (or reveals) a project at `url`. This sequences the document
    /// lifecycle explicitly — resolve UTI, make the document, register it,
    /// and optionally display — instead of relying on
    /// `openDocument(withContentsOf:display:completionHandler:)`, whose async
    /// internal flow was swallowing failures in the live app and producing no
    /// visible window.
    @discardableResult
    private func openProject(at url: URL) -> NSDocument? {
        if let existing = document(for: url) {
            logger.info("openProject: document already open for \(url.path, privacy: .public)")
            if shouldDisplayOpenedDocuments { existing.showWindows() }
            didFinishOpeningDocument?(existing, nil)
            return existing
        }

        let typeName: String
        let doc: NSDocument
        do {
            typeName = try typeForContents(of: url)
            doc = try makeDocument(withContentsOf: url, ofType: typeName)
        } catch {
            logger.error("openProject: load failed for \(url.path, privacy: .public): \(error.localizedDescription, privacy: .public)")
            didFinishOpeningDocument?(nil, error)
            return nil
        }

        addDocument(doc)
        logger.info("openProject: registered \(String(describing: Swift.type(of: doc)), privacy: .public) for \(url.path, privacy: .public)")

        if shouldDisplayOpenedDocuments {
            if doc.windowControllers.isEmpty {
                doc.makeWindowControllers()
            }
            doc.showWindows()
            if let window = doc.windowControllers.first?.window {
                logger.info("openProject: window visible=\(window.isVisible) frame=\(NSStringFromRect(window.frame), privacy: .public)")
                window.makeKeyAndOrderFront(nil)
                NSApp.activate(ignoringOtherApps: true)
            } else {
                logger.error("openProject: no window after showWindows")
            }
        }

        didFinishOpeningDocument?(doc, nil)
        return doc
    }

    /// Creates an empty `.whiproj` package at `url` seeded with an initial
    /// two-pane horizontal layout. Returns the canonical URL (with extension
    /// appended if missing). Exposed for integration tests.
    public static func writeEmptyPackage(at url: URL) throws -> URL {
        let finalURL = url.pathExtension.lowercased() == Self.projectExtension
            ? url
            : url.appendingPathExtension(Self.projectExtension)

        let fm = FileManager.default
        if fm.fileExists(atPath: finalURL.path) {
            try fm.removeItem(at: finalURL)
        }
        try fm.createDirectory(at: finalURL, withIntermediateDirectories: true)
        let dbURL = finalURL.appendingPathComponent(NestedSplitViewDocument.databaseFilename)
        let store = try DocumentLayoutStore(path: dbURL.path)
        let initialLayout = LayoutNode.split(
            orientation: "horizontal",
            first: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier),
            second: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier)
        )
        let tab = TabRecord(title: "Tab 1", root: initialLayout)
        try store.saveTabs([tab], activeTabID: tab.id)
        return finalURL
    }
}

@MainActor
public final class DefaultProjectURLPrompter: ProjectURLPrompting {

    private let projectUTI = "com.mikefullerton.whippet.project"

    public func promptForNewProjectURL() -> URL? {
        let panel = NSSavePanel()
        panel.title = "New Whippet Project"
        panel.nameFieldStringValue = "Untitled"
        panel.canCreateDirectories = true
        panel.allowedContentTypes = [UTType(projectUTI)].compactMap { $0 }
        panel.allowsOtherFileTypes = false
        panel.isExtensionHidden = false

        let response = panel.runModal()
        logger.info("save panel closed with response=\(response.rawValue) url=\(panel.url?.path ?? "<nil>", privacy: .public)")
        guard response == .OK else { return nil }
        return panel.url
    }

    public func promptForExistingProjectURLs() -> [URL] {
        let panel = NSOpenPanel()
        panel.title = "Open Whippet Project"
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.treatsFilePackagesAsDirectories = false
        panel.allowsMultipleSelection = false
        panel.allowedContentTypes = [UTType(projectUTI)].compactMap { $0 }

        let response = panel.runModal()
        logger.info("open panel closed with response=\(response.rawValue) urls=\(panel.urls.map(\.path).joined(separator: ","), privacy: .public)")
        guard response == .OK else { return [] }
        return panel.urls
    }
}

extension WhippetDocumentController: Loggable {
    public static nonisolated let logger = makeLogger()
}

extension DefaultProjectURLPrompter: Loggable {
    public static nonisolated let logger = makeLogger()
}

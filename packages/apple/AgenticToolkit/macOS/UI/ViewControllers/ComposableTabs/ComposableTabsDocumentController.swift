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

/// The `NSDocumentController` behind `.whiproj` packages.
///
/// Not `final`: `ComposableLayoutDocumentControllerDemo` subclasses it to hand
/// its documents a different `ComposableTabsLayout`, which is the whole of the
/// difference between the demo and a real app document.
public class ComposableTabsDocumentController: NSDocumentController {

    private static let projectUTI = "com.mikefullerton.whippet.project"
    /// Public because pane content has to recognise the project package too —
    /// the file browser shows it as one opaque item rather than a folder.
    public static let projectExtension = "whiproj"

    /// The layout given to every document this controller creates or opens.
    /// The base answers with whatever the app installed; a subclass can vend
    /// its own view set without touching a global (`dependency-injection`).
    public var documentLayout: ComposableTabsLayout {
        ComposableTabsLayout.current ?? ComposableTabsLayout.placeholderOnly()
    }

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
        logger.info("ComposableTabsDocumentController.newDocument(_:) invoked")
        NSApp.activate(ignoringOtherApps: true)
        guard let url = urlPrompter.promptForNewProjectURL() else {
            logger.info("newDocument: prompter returned nil — user cancelled")
            return
        }
        createDocumentPackage(at: url)
    }

    @IBAction public override func openDocument(_ sender: Any?) {
        logger.info("ComposableTabsDocumentController.openDocument(_:) invoked")
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
            finalURL = try Self.writeEmptyPackage(at: url, root: documentLayout.blueprint())
        } catch {
            // swiftlint:disable:next line_length
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
            // swiftlint:disable:next line_length
            logger.error("openProject: load failed for \(url.path, privacy: .public): \(error.localizedDescription, privacy: .public)")
            didFinishOpeningDocument?(nil, error)
            return nil
        }

        (doc as? ComposableTabsDocument)?.layout = documentLayout
        addDocument(doc)
        // swiftlint:disable:next line_length
        logger.info("openProject: registered \(String(describing: Swift.type(of: doc)), privacy: .public) for \(url.path, privacy: .public)")

        if shouldDisplayOpenedDocuments {
            if doc.windowControllers.isEmpty {
                doc.makeWindowControllers()
            }
            doc.showWindows()
            if let window = doc.windowControllers.first?.window {
                // swiftlint:disable:next line_length
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

    /// Creates an empty `.whiproj` package at `url` seeded with the app's
    /// default tab layout. Returns the canonical URL (with extension appended
    /// if missing). Exposed for integration tests.
    public static func writeEmptyPackage(at url: URL, root: LayoutNode? = nil) throws -> URL {
        let finalURL = url.pathExtension.lowercased() == Self.projectExtension
            ? url
            : url.appendingPathExtension(Self.projectExtension)

        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: finalURL.path) {
            try fileManager.removeItem(at: finalURL)
        }
        try fileManager.createDirectory(at: finalURL, withIntermediateDirectories: true)
        let dbURL = finalURL.appendingPathComponent(ComposableTabsDocument.databaseFilename)
        let store = try DocumentLayoutStore(path: dbURL.path)
        let tab = TabRecord(title: "Tab 1", root: root ?? ComposableTabsLayout.makeTabLayout())
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
        // swiftlint:disable:next line_length
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
        // swiftlint:disable:next line_length
        logger.info("open panel closed with response=\(response.rawValue) urls=\(panel.urls.map(\.path).joined(separator: ","), privacy: .public)")
        guard response == .OK else { return [] }
        return panel.urls
    }
}

extension ComposableTabsDocumentController: Loggable {
    public static nonisolated let logger = makeLogger()
}

extension DefaultProjectURLPrompter: Loggable {
    public static nonisolated let logger = makeLogger()
}

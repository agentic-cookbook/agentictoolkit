import AgenticToolkitCore
import SwiftUI
import AppKit
import Combine
import CodeEditSourceEditor
import CodeEditLanguages
import os

/// Shows whatever the file tree has selected.
///
/// Text files open in an editable, syntax-highlighted source editor; edits are
/// written back when the selection moves off the file. Everything else —
/// images, PDFs, movies — goes to QuickLook, so clicking a file shows the file
/// rather than an apology (`principle-of-least-astonishment`).
///
/// Colors and font come from the app theme in the environment, so the editor
/// follows a theme switch like the rest of the UI and there is no second
/// palette to keep in step (see `SemanticPalette.editorTheme`).
public struct FileEditorView: View {
    /// The currently selected file tree node, or `nil` if nothing is selected.
    public let selectedNode: FileTreeNode?

    /// Owned here rather than inside the content view. Selecting a directory
    /// or nothing switches which branch of `body` exists, and SwiftUI destroys
    /// the branch it leaves — taking a `@StateObject` living in it, and with it
    /// any unsaved edits, before anything had a chance to write them
    /// (`explicit-over-implicit` about who owns the open file).
    @StateObject private var editorState = EditorState()

    public init(selectedNode: FileTreeNode?) {
        self.selectedNode = selectedNode
    }

    /// Whether the selection is something the editor can open at all.
    private var openableNode: FileTreeNode? {
        guard let node = selectedNode, !node.isDirectory, !node.isPackage else { return nil }
        return node
    }

    public var body: some View {
        Group {
            if openableNode != nil {
                FileEditorContentView(editorState: editorState)
            } else {
                EditorPlaceholderView(message: "Select a file to view its contents")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .onAppear { showSelection() }
        .onChange(of: selectedNode) { showSelection() }
    }

    /// Writes back whatever was open, then opens what is selected now. Both
    /// halves run for every selection change, including the ones that show no
    /// editor at all — that is the case the old placement could not cover.
    private func showSelection() {
        editorState.save()
        if let node = openableNode {
            editorState.load(from: node.url)
        } else {
            editorState.unload()
        }
    }
}

// MARK: - Placeholder

/// Shown when no file is selected or when a directory is selected.
private struct EditorPlaceholderView: View {
    public let message: String

    @Environment(\.theme) private var theme

    public var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.system(size: 48))
                .foregroundStyle(theme.tertiaryText)

            Text(message)
                .font(theme.font(.heading))
                .foregroundStyle(theme.secondaryText)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - File Editor Content

/// Loads the file and shows it the way `FilePreviewLoader` classified it.
private struct FileEditorContentView: View {
    /// Observed, not owned: the state outlives this view (see `FileEditorView`).
    @ObservedObject var editorState: EditorState

    @Environment(\.themePalette) private var appPalette

    private var language: CodeLanguage {
        LanguageDetection.language(for: editorState.currentURL ?? URL(fileURLWithPath: "/untitled"))
    }

    public var body: some View {
        VStack(spacing: 0) {
            switch editorState.display {
            case .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

            case .text:
                SourceEditor(
                    $editorState.content,
                    language: language,
                    configuration: SourceEditorConfiguration(
                        appearance: .init(
                            // Both derived from the one palette in the
                            // environment, so a theme switch repaints the
                            // editor's chrome, syntax and font together.
                            theme: appPalette.editorTheme,
                            font: appPalette.font(.code),
                            wrapLines: false
                        ),
                        peripherals: .init(
                            showGutter: true,
                            showMinimap: true
                        )
                    ),
                    state: $editorState.sourceEditorState
                )
                .id(editorState.loadGeneration)

            case .quickLook(let url):
                QuickLookPreview(url: url)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

            case .unavailable:
                EditorPlaceholderView(message: "Cannot open this file")
            }
        }
    }
}

// MARK: - Editor State

/// Observable state for the file viewer: what to show, the text if there is
/// text, dirty tracking, and file I/O.
@MainActor
private final class EditorState: ObservableObject {

    /// What the viewer is showing for the current file.
    enum Display: Equatable {
        /// Still reading.
        case loading
        /// UTF-8 text, live in the source editor.
        case text
        /// Handed to QuickLook — an image, a PDF, a movie, or a file too large
        /// for the editor.
        case quickLook(URL)
        /// Unreadable.
        case unavailable
    }

    /// How the current file is being shown.
    @Published public var display: Display = .loading

    /// The current text content displayed in the editor.
    @Published public var content: String = ""

    /// Whether the editor's text differs from what is on disk.
    ///
    /// Computed rather than tracked. The stored flag it replaces was driven by
    /// a `$content` sink, and `@Published` fires in `willSet` — so the sink
    /// compared the *incoming* file's text against the *previous* file's saved
    /// content and latched true on every load. Combined with QuickLook files
    /// leaving `content` empty, that latch is what let `save()` write an empty
    /// string over a PNG on the way out. A comparison cannot go stale.
    public var isModified: Bool { display == .text && content != savedContent }

    /// Monotonic counter incremented on each load, used as `.id()` to force SourceEditor recreation.
    @Published public var loadGeneration: Int = 0

    /// State for the SourceEditor (cursor position, scroll, find panel).
    @Published public var sourceEditorState = SourceEditorState()

    /// The URL of the currently loaded file.
    public var currentURL: URL?

    /// The content as it was at the last save/load, for dirty-checking.
    private var savedContent: String = ""

    /// The in-flight read. Cancelled when a new selection arrives so a slow
    /// file can't land on top of a newer one.
    private var loadTask: Task<Void, Never>?

    deinit {
        loadTask?.cancel()
    }

    /// Reads `url` off the main thread and shows it however it classifies.
    public func load(from url: URL) {
        loadTask?.cancel()

        guard url != currentURL else { return }

        currentURL = url
        display = .loading
        sourceEditorState = SourceEditorState()

        loadTask = Task { [weak self] in
            let content = await FilePreviewLoader.read(url)
            guard let self, !Task.isCancelled, self.currentURL == url else { return }

            switch content {
            case .text(let text):
                self.content = text
                self.savedContent = text
                self.loadGeneration += 1
                self.display = .text
                logger.info("Loaded file: \(url.lastPathComponent, privacy: .public)")

            case .quickLook:
                self.content = ""
                self.savedContent = ""
                self.display = .quickLook(url)

            case .unavailable:
                self.content = ""
                self.savedContent = ""
                self.display = .unavailable
            }
        }
    }

    /// Forgets the current file, after any pending save. The selection has
    /// moved to a directory or to nothing, and a state still pointing at a file
    /// nobody is looking at is a file a later save could land on.
    public func unload() {
        loadTask?.cancel()
        currentURL = nil
        content = ""
        savedContent = ""
        display = .loading
    }

    /// Saves the current content back to disk.
    public func save() {
        guard let url = currentURL else { return }
        // `isModified` is false for anything that is not text, so a QuickLook
        // preview's empty `content` can never be written over the file it is
        // previewing.
        guard isModified else { return }

        do {
            try content.write(to: url, atomically: true, encoding: .utf8)
            savedContent = content
            logger.info("Saved file: \(url.lastPathComponent, privacy: .public)")
        } catch {
            logger.error("Failed to save file: \(error.localizedDescription, privacy: .public)")
        }
    }
}

extension EditorState: Loggable {
    public static nonisolated let logger = makeLogger()
}

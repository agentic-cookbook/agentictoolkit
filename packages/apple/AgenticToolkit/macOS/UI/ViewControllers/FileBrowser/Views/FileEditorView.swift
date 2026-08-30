import AgenticToolkitCore
import SwiftUI
import AppKit
import Combine
import CodeEditSourceEditor
import CodeEditLanguages
import os

/// Shows whatever the file tree has selected.
///
/// Text files open in an editable, syntax-highlighted source editor (Cmd+S to
/// save, dirty state tracked). Everything else — images, PDFs, movies — goes to
/// QuickLook, so clicking a file shows the file rather than an apology
/// (`principle-of-least-astonishment`).
///
/// Colors and font come from the app theme in the environment, so the editor
/// follows a theme switch like the rest of the UI and there is no second
/// palette to keep in step (see `SemanticPalette.editorTheme`).
public struct FileEditorView: View {
    /// The currently selected file tree node, or `nil` if nothing is selected.
    public let selectedNode: FileTreeNode?

    public init(selectedNode: FileTreeNode?) {
        self.selectedNode = selectedNode
    }

    public var body: some View {
        Group {
            if let node = selectedNode {
                if node.isDirectory || node.isPackage {
                    EditorPlaceholderView(message: "Select a file to view its contents")
                } else {
                    FileEditorContentView(node: node)
                }
            } else {
                EditorPlaceholderView(message: "Select a file to view its contents")
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
    public let node: FileTreeNode

    @Environment(\.themePalette) private var appPalette
    @StateObject private var editorState = EditorState()

    public init(node: FileTreeNode) {
        self.node = node
    }

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
        .onAppear {
            editorState.load(from: node.url)
        }
        .onChange(of: node) {
            // Save current file if modified before switching
            if editorState.isModified {
                editorState.save()
            }
            editorState.load(from: node.url)
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

    /// Whether the content has been modified since the last save or load.
    @Published public var isModified: Bool = false

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

    /// Combine subscription for dirty tracking.
    private var cancellables = Set<AnyCancellable>()

    public init() {
        // Track content changes for dirty state via Combine
        $content
            .dropFirst()
            .sink { [weak self] newValue in
                guard let self = self else { return }
                self.isModified = (newValue != self.savedContent)
            }
            .store(in: &cancellables)
    }

    deinit {
        loadTask?.cancel()
    }

    /// Reads `url` off the main thread and shows it however it classifies.
    public func load(from url: URL) {
        loadTask?.cancel()

        currentURL = url
        isModified = false
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

    /// Saves the current content back to disk.
    public func save() {
        guard let url = currentURL else { return }
        guard isModified else { return }

        do {
            try content.write(to: url, atomically: true, encoding: .utf8)
            savedContent = content
            isModified = false
            logger.info("Saved file: \(url.lastPathComponent, privacy: .public)")
        } catch {
            logger.error("Failed to save file: \(error.localizedDescription, privacy: .public)")
        }
    }
}

extension EditorState: Loggable {
    public static nonisolated let logger = makeLogger()
}

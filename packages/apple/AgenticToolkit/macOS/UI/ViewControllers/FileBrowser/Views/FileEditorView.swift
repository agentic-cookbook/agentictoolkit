import AgenticToolkitCore
import SwiftUI
import AppKit
import Combine
import CodeEditSourceEditor
import CodeEditLanguages
import os

/// A text editor view for displaying and editing file contents.
///
/// When a file is selected in the file tree, this view reads the file as UTF-8
/// text and presents it in an editable, monospace `NSTextView` wrapped in a
/// scroll view. Supports Cmd+S to save, tracks dirty state, and gracefully
/// handles binary or unreadable files.
///
/// Themes for light and dark appearance are injected at initialization.
public struct FileEditorView: View {
    /// The currently selected file tree node, or `nil` if nothing is selected.
    public let selectedNode: FileTreeNode?

    /// Theme used when the system color scheme is light.
    public let lightTheme: EditorTheme

    /// Theme used when the system color scheme is dark.
    public let darkTheme: EditorTheme

    public init(selectedNode: FileTreeNode?, lightTheme: EditorTheme, darkTheme: EditorTheme) {
        self.selectedNode = selectedNode
        self.lightTheme = lightTheme
        self.darkTheme = darkTheme
    }

    public var body: some View {
        Group {
            if let node = selectedNode {
                if node.isDirectory || node.isPackage {
                    EditorPlaceholderView(message: "Select a file to view its contents")
                } else {
                    FileEditorContentView(node: node, lightTheme: lightTheme, darkTheme: darkTheme)
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

    public var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text(message)
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - File Editor Content

/// Loads the file and shows either the text editor or a "cannot display" message.
private struct FileEditorContentView: View {
    public let node: FileTreeNode
    public let lightTheme: EditorTheme
    public let darkTheme: EditorTheme

    @Environment(\.colorScheme) private var colorScheme
    @StateObject private var editorState = EditorState()
    @State private var theme: EditorTheme

    public init(node: FileTreeNode, lightTheme: EditorTheme, darkTheme: EditorTheme) {
        self.node = node
        self.lightTheme = lightTheme
        self.darkTheme = darkTheme
        _theme = State(initialValue: lightTheme)
    }

    private var language: CodeLanguage {
        LanguageDetection.language(for: editorState.currentURL ?? URL(fileURLWithPath: "/untitled"))
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Editor or error
            if !editorState.isLoaded {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if editorState.loadError {
                EditorPlaceholderView(message: "Cannot display this file type")
            } else {
                SourceEditor(
                    $editorState.content,
                    language: language,
                    configuration: SourceEditorConfiguration(
                        appearance: .init(
                            theme: theme,
                            font: NSFont(name: "Menlo", size: 13)
                                ?? .monospacedSystemFont(ofSize: 13, weight: .regular),
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
            }
        }
        .onAppear {
            theme = colorScheme == .dark ? darkTheme : lightTheme
            editorState.load(from: node.url)
        }
        .onChange(of: node) {
            // Save current file if modified before switching
            if editorState.isModified {
                editorState.save()
            }
            editorState.load(from: node.url)
        }
        .onChange(of: colorScheme) {
            theme = colorScheme == .dark ? darkTheme : lightTheme
        }
    }
}

// MARK: - Editor State

/// Observable state for the file editor, managing content, dirty tracking, and file I/O.
private final class EditorState: ObservableObject {
    /// The current text content displayed in the editor.
    @Published public var content: String = ""

    /// Whether the content has been modified since the last save or load.
    @Published public var isModified: Bool = false

    /// Whether the file could not be read as UTF-8 text.
    @Published public var loadError: Bool = false

    /// Whether the initial file load has completed (gates SourceEditor creation).
    @Published public var isLoaded: Bool = false

    /// Monotonic counter incremented on each load, used as `.id()` to force SourceEditor recreation.
    @Published public var loadGeneration: Int = 0

    /// State for the SourceEditor (cursor position, scroll, find panel).
    @Published public var sourceEditorState = SourceEditorState()

    /// The URL of the currently loaded file.
    public var currentURL: URL?

    /// The content as it was at the last save/load, for dirty-checking.
    private var savedContent: String = ""

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

    /// Attempts to load a file as UTF-8 text.
    public func load(from url: URL) {
        currentURL = url
        isModified = false
        loadError = false
        isLoaded = false
        sourceEditorState = SourceEditorState()

        do {
            let data = try Data(contentsOf: url)
            guard let text = String(data: data, encoding: .utf8) else {
                logger.warning("File is not valid UTF-8: \(url.lastPathComponent, privacy: .public)")
                loadError = true
                content = ""
                savedContent = ""
                isLoaded = true
                return
            }
            content = text
            savedContent = text
            loadGeneration += 1
            isLoaded = true
            logger.info("Loaded file: \(url.lastPathComponent, privacy: .public) (\(data.count) bytes)")
        } catch {
            logger.error("Failed to read file: \(error.localizedDescription, privacy: .public)")
            loadError = true
            content = ""
            savedContent = ""
            isLoaded = true
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

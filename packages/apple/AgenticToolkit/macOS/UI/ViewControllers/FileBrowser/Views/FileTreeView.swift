import AppKit
import SwiftUI

import AgenticToolkitCore

/// A file tree browser view that displays a repository's directory structure.
///
/// Uses `List` with `OutlineGroup` to show an expandable, hierarchical file tree.
/// Directories appear first, sorted alphabetically, followed by files. Hidden files
/// (including `.claude`) are visible. Package bundles (configured via
/// `FileTreeConfig.packageExtensions`) are displayed as single non-expandable items.
/// Files with git changes show status badges.
public struct FileTreeView: View {
    /// The root node of the file tree.
    public let rootNode: FileTreeNode

    /// The currently selected file tree node, bound to the parent view.
    @Binding public var selectedNode: FileTreeNode?

    @Environment(\.theme) private var theme

    public init(rootNode: FileTreeNode, selectedNode: Binding<FileTreeNode?>) {
        self.rootNode = rootNode
        self._selectedNode = selectedNode
    }

    public var body: some View {
        List(selection: $selectedNode) {
            ForEach(rootNode.children ?? []) { node in
                FileTreeNodeView(node: node)
            }
        }
        .listStyle(.sidebar)
        // The sidebar style paints its own translucent material, which is the
        // system's appearance rather than the theme's — hiding it is what lets
        // the pane sit on the same surface as everything beside it. The tint is
        // what colors the selection capsule, so it has to be the theme's accent
        // or a themed tree still highlights in the system blue.
        .scrollContentBackground(.hidden)
        .background(theme.windowBackground)
        .tint(theme.accent)
    }
}

/// A file tree browser over several root directories at once, one collapsible
/// section per root.
///
/// Separate from `FileTreeView` rather than a mode of it: a single-root tree
/// shows its contents flat, with no header to explain what they are, and that
/// is still the right view for a sidebar over one folder
/// (`principle-of-least-astonishment`).
public struct FileTreeRootsView: View {

    /// One manager per root, in display order.
    public let managers: [FileTreeManager]

    /// The root the `+`/`−` controls act on.
    @Binding public var selectedRoot: URL?

    /// The currently selected file tree node, bound to the parent view.
    @Binding public var selectedNode: FileTreeNode?

    @Environment(\.theme) private var theme

    public init(
        managers: [FileTreeManager],
        selectedRoot: Binding<URL?>,
        selectedNode: Binding<FileTreeNode?>
    ) {
        self.managers = managers
        self._selectedRoot = selectedRoot
        self._selectedNode = selectedNode
    }

    public var body: some View {
        List(selection: $selectedNode) {
            ForEach(managers, id: \.repoRootURL) { manager in
                Section {
                    FileTreeRootSection(manager: manager)
                } header: {
                    header(for: manager.repoRootURL)
                }
            }
        }
        .listStyle(.sidebar)
        .scrollContentBackground(.hidden)
        .background(theme.windowBackground)
        .tint(theme.accent)
    }

    /// Clicking a header is how a root with nothing selected inside it becomes
    /// the target of `−`; without it, removing an empty directory would mean
    /// first finding a file in it to click.
    private func header(for url: URL) -> some View {
        HStack(spacing: 4) {
            Text(url.lastPathComponent)
                .font(theme.font(.caption))
                .foregroundStyle(selectedRoot == url ? theme.primaryText : theme.secondaryText)
            Spacer()
        }
        .contentShape(Rectangle())
        .help(url.path)
        .onTapGesture { selectedRoot = url }
    }
}

/// The rows under one root. Its own view so each root's manager is observed
/// individually — a scan finishing in one directory redraws that section, not
/// every section.
public struct FileTreeRootSection: View {

    @ObservedObject public var manager: FileTreeManager

    @Environment(\.theme) private var theme

    public init(manager: FileTreeManager) {
        self.manager = manager
    }

    public var body: some View {
        if let children = manager.rootNode?.children, !children.isEmpty {
            ForEach(children) { node in
                FileTreeNodeView(node: node)
            }
        } else if manager.isSyncing {
            ProgressView()
                .controlSize(.small)
                .listRowBackground(Color.clear)
        } else {
            Text("Empty")
                .font(theme.font(.caption))
                .foregroundStyle(theme.tertiaryText)
                .listRowBackground(Color.clear)
        }
    }
}

/// One node, and — when it is an expanded directory — the nodes under it.
///
/// Recursive rather than an `OutlineGroup` because each level has to *observe*
/// its own node. A directory reads its contents after its row is already on
/// screen, and an outline walks `\.children` once, when the view that owns it
/// is built: children arriving a moment later never reach it, so the directory
/// opens onto nothing. Here the view that reads a node's children is the view
/// that observes that node, so the two cannot drift apart.
public struct FileTreeNodeView: View {

    @ObservedObject public var node: FileTreeNode

    @State private var isExpanded = false

    public init(node: FileTreeNode) {
        self.node = node
    }

    public var body: some View {
        if node.children == nil {
            row
        } else {
            DisclosureGroup(isExpanded: $isExpanded) {
                ForEach(node.children ?? []) { child in
                    FileTreeNodeView(node: child)
                }
            } label: {
                row
            }
            // Belt and braces against the row-appearance prefetch: a directory
            // opened before its read finished still gets one here, and a second
            // call is a no-op.
            .onChange(of: isExpanded) { _, expanded in
                if expanded { node.loadChildrenIfNeeded() }
            }
        }
    }

    private var row: some View {
        FileTreeRow(node: node)
            .tag(node)
            .listRowBackground(Color.clear)
    }
}

/// A single row in the file tree, showing an icon, file/folder name, and git status badge.
public struct FileTreeRow: View {
    @ObservedObject public var node: FileTreeNode

    @Environment(\.theme) private var theme

    public init(node: FileTreeNode) {
        self.node = node
    }

    public var body: some View {
        HStack(spacing: 4) {
            Label {
                Text(node.name)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .foregroundStyle(nameColor)
            } icon: {
                Image(systemName: node.systemImageName)
                    .foregroundStyle(iconColor)
            }

            Spacer()

            if let status = node.gitStatus {
                Text(status.displayCharacter)
                    .font(theme.font(.code).bold())
                    .foregroundStyle(status.color)
                    .padding(.horizontal, 3)
            }
        }
        .contentShape(Rectangle())
        .help(node.url.path)
        // A directory reads its contents when its own row appears, one level
        // ahead of the disclosure triangle the user is about to click. Reading
        // it on expansion instead would show an empty directory for as long as
        // the enumeration took, and reading the whole checkout up front is what
        // this replaced.
        .onAppear { node.loadChildrenIfNeeded() }
        // `simultaneousGesture`, not `onTapGesture`: a tap gesture attached the
        // ordinary way *replaces* the row's built-in click handling, so the
        // List never sees the single click and selecting a file silently stops
        // working. Running alongside it leaves selection intact.
        .simultaneousGesture(
            TapGesture(count: 2).onEnded {
                if !node.isDirectory {
                    NSWorkspace.shared.open(node.url)
                }
            }
        )
    }

    /// Name color tinted by git status. `status.color` is the git status's own
    /// color, not app chrome, so it stays as-is (see FileTreeNode.GitStatus).
    private var nameColor: Color {
        if let status = node.gitStatus {
            return status.color
        }
        return theme.primaryText
    }

    /// The color for the file/folder icon.
    ///
    /// The palette has no per-language "brand color" role, so these map onto
    /// the nearest status role the same way `SwiftUIPalette.color(named:)`
    /// does (orange/yellow → warning, blue → accent, purple → info) — swift
    /// and json land on the same tone, which is already true of that shared
    /// mapping.
    private var iconColor: Color {
        if node.isPackage {
            return theme.warning
        }
        if node.isDirectory {
            if node.name == ".claude" {
                return theme.info
            }
            return theme.accent
        }
        let ext = node.url.pathExtension.lowercased()
        switch ext {
        case "swift":
            return theme.warning
        case "json":
            return theme.warning
        case "md", "markdown":
            return theme.accent
        default:
            return theme.secondaryText
        }
    }
}

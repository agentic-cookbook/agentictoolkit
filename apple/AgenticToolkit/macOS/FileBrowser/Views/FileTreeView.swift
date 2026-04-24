import AppKit
import SwiftUI

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

    public init(rootNode: FileTreeNode, selectedNode: Binding<FileTreeNode?>) {
        self.rootNode = rootNode
        self._selectedNode = selectedNode
    }

    public var body: some View {
        List(selection: $selectedNode) {
            if let children = rootNode.children {
                OutlineGroup(children, children: \.children) { node in
                    FileTreeRow(node: node)
                        .tag(node)
                }
            }
        }
        .listStyle(.sidebar)
    }
}

/// A single row in the file tree, showing an icon, file/folder name, and git status badge.
public struct FileTreeRow: View {
    @ObservedObject public var node: FileTreeNode

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
                    .font(.caption2.monospaced().bold())
                    .foregroundStyle(status.color)
                    .padding(.horizontal, 3)
            }
        }
        .help(node.url.path)
        .onTapGesture(count: 2) {
            if !node.isDirectory {
                NSWorkspace.shared.open(node.url)
            }
        }
    }

    /// Name color tinted by git status.
    private var nameColor: Color {
        if let status = node.gitStatus {
            return status.color
        }
        return .primary
    }

    /// The color for the file/folder icon.
    private var iconColor: Color {
        if node.isPackage {
            return .orange
        }
        if node.isDirectory {
            if node.name == ".claude" {
                return .purple
            }
            return .accentColor
        }
        let ext = node.url.pathExtension.lowercased()
        switch ext {
        case "swift":
            return .orange
        case "json":
            return .yellow
        case "md", "markdown":
            return .blue
        default:
            return .secondary
        }
    }
}

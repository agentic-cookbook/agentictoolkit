import SwiftUI

/// The content viewer pane that displays file metadata when a file is selected.
///
/// Shows a placeholder message ("Select a file to view its details") when no file
/// is selected. When a file or directory is selected, shows its name, full path,
/// file size, modification date, and type.
public struct ContentViewerView: View {
    /// The currently selected file tree node, or `nil` if nothing is selected.
    public let selectedNode: FileTreeNode?

    /// Framework configuration. Used for package display names.
    public let config: FileTreeConfig

    public init(selectedNode: FileTreeNode?, config: FileTreeConfig) {
        self.selectedNode = selectedNode
        self.config = config
    }

    public var body: some View {
        Group {
            if let node = selectedNode {
                FileDetailView(node: node, config: config)
            } else {
                PlaceholderView()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Placeholder View

/// Shown when no file is selected in the file tree.
private struct PlaceholderView: View {
    public var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "doc.text.magnifyingglass")
                .font(.system(size: 48))
                .foregroundStyle(.tertiary)

            Text("Select a file to view its details")
                .font(.title3)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - File Detail View

/// Displays detailed metadata for a selected file or directory.
private struct FileDetailView: View {
    public let node: FileTreeNode
    public let config: FileTreeConfig

    /// Formatter for file sizes.
    private static let byteCountFormatter: ByteCountFormatter = {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter
    }()

    /// Formatter for dates.
    private static let dateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .long
        formatter.timeStyle = .medium
        return formatter
    }()

    public var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(spacing: 8) {
                Image(systemName: node.systemImageName)
                    .font(.system(size: 40))
                    .foregroundStyle(headerIconColor)

                Text(node.name)
                    .font(.title2)
                    .fontWeight(.semibold)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)

                Text(typeDescription)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 20)

            Divider()
                .padding(.horizontal, 40)

            // Metadata grid
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 12) {
                GridRow {
                    Text("Path:")
                        .foregroundStyle(.secondary)
                        .gridColumnAlignment(.trailing)
                    Text(node.url.path)
                        .textSelection(.enabled)
                        .lineLimit(3)
                        .gridColumnAlignment(.leading)
                }

                if let size = node.fileSize {
                    GridRow {
                        Text("Size:")
                            .foregroundStyle(.secondary)
                        Text(Self.byteCountFormatter.string(fromByteCount: Int64(size)))
                    }
                }

                if let date = node.modificationDate {
                    GridRow {
                        Text("Modified:")
                            .foregroundStyle(.secondary)
                        Text(Self.dateFormatter.string(from: date))
                    }
                }

                GridRow {
                    Text("Type:")
                        .foregroundStyle(.secondary)
                    Text(typeDescription)
                }

                if !node.isDirectory, !node.url.pathExtension.isEmpty {
                    GridRow {
                        Text("Extension:")
                            .foregroundStyle(.secondary)
                        Text(".\(node.url.pathExtension)")
                    }
                }

                if let children = node.children {
                    GridRow {
                        Text("Items:")
                            .foregroundStyle(.secondary)
                        Text("\(children.count)")
                    }
                }
            }
            .font(.body)
            .padding(.top, 20)
            .padding(.horizontal, 40)

            Spacer()
        }
        .padding(.top, 40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Human-readable description of the file type.
    private var typeDescription: String {
        if node.isPackage {
            let ext = node.url.pathExtension
            return config.packageDisplayNames[ext] ?? "Package"
        }
        if node.isDirectory {
            return "Directory"
        }
        let ext = node.url.pathExtension.lowercased()
        switch ext {
        case "swift": return "Swift Source File"
        case "json": return "JSON File"
        case "md", "markdown": return "Markdown Document"
        case "txt", "text": return "Text File"
        case "plist": return "Property List"
        case "entitlements": return "Entitlements File"
        case "xcodeproj": return "Xcode Project"
        case "xcworkspace": return "Xcode Workspace"
        case "png": return "PNG Image"
        case "jpg", "jpeg": return "JPEG Image"
        case "svg": return "SVG Image"
        case "gif": return "GIF Image"
        case "sh": return "Shell Script"
        case "zsh": return "Zsh Script"
        case "bash": return "Bash Script"
        case "py": return "Python Script"
        case "js": return "JavaScript File"
        case "ts": return "TypeScript File"
        case "css": return "CSS Stylesheet"
        case "html": return "HTML Document"
        case "yaml", "yml": return "YAML File"
        case "toml": return "TOML File"
        case "gitignore": return "Git Ignore Rules"
        default: return ext.isEmpty ? "File" : "\(ext.uppercased()) File"
        }
    }

    /// Color for the header icon.
    private var headerIconColor: Color {
        if node.isPackage { return .orange }
        if node.isDirectory { return .accentColor }
        let ext = node.url.pathExtension.lowercased()
        switch ext {
        case "swift": return .orange
        case "json": return .yellow
        case "md", "markdown": return .blue
        default: return .secondary
        }
    }
}

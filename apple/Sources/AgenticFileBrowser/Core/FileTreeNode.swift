import Foundation
import Combine

/// A node in the file tree representing a file or directory.
///
/// Each node contains the file URL, display name, and lazily-loaded children
/// for directories. The tree is built by enumerating the file system starting
/// from the project's repository root directory.
///
/// Nodes are `Identifiable` (by URL path) and `Hashable` for use with
/// `OutlineGroup` and SwiftUI `List` selection.
public final class FileTreeNode: Identifiable, ObservableObject, Hashable, @unchecked Sendable {

    /// Unique identifier derived from the file URL path.
    public let id: String

    /// The file system URL for this node.
    public let url: URL

    /// The display name shown in the file tree.
    public let name: String

    /// Whether this node represents a directory.
    public let isDirectory: Bool

    /// Whether this node represents a package extension that should be shown
    /// as a single item (not expanded). Determined by caller-supplied
    /// `packageExtensions` on construction.
    public let isPackage: Bool

    /// The child nodes for directories. `nil` for files and packages.
    @Published public var children: [FileTreeNode]?

    /// File size in bytes, if available. Only populated for files.
    public let fileSize: Int?

    /// Last modification date, if available.
    public let modificationDate: Date?

    /// Git status for this file or directory, if tracked.
    @Published public var gitStatus: GitFileStatus?

    // MARK: - Initialization

    /// Creates a file tree node from a file URL.
    ///
    /// - Parameters:
    ///   - url: The file system URL for this file or directory.
    ///   - isDirectory: Whether this URL points to a directory.
    ///   - loadChildren: Whether to recursively load children for directories.
    ///     Pass `false` for lazy loading.
    ///   - ignorePatterns: Wildcard patterns for filenames to exclude.
    ///   - packageExtensions: Extensions that identify directories as opaque
    ///     packages (e.g. `catnip-proj`). Packages appear as single items.
    public init(
        url: URL,
        isDirectory: Bool,
        loadChildren: Bool = false,
        ignorePatterns: [String] = [],
        packageExtensions: Set<String> = []
    ) {
        self.id = url.path
        self.url = url
        self.name = url.lastPathComponent
        self.isDirectory = isDirectory

        let isPkg = packageExtensions.contains(url.pathExtension)
        self.isPackage = isPkg

        // Read file attributes
        let attributes = try? FileManager.default.attributesOfItem(atPath: url.path)
        self.fileSize = isDirectory ? nil : attributes?[.size] as? Int
        self.modificationDate = attributes?[.modificationDate] as? Date

        // Directories that are not packages get children
        if isDirectory && !isPkg {
            if loadChildren {
                self.children = FileTreeNode.loadChildren(
                    for: url,
                    ignorePatterns: ignorePatterns,
                    packageExtensions: packageExtensions
                )
            } else {
                // Empty array signals "expandable but not yet loaded"
                self.children = []
            }
        } else {
            self.children = nil
        }
    }

    /// Creates a file tree node from cached data without hitting the filesystem.
    public init(
        cachedPath: String,
        name: String,
        isDirectory: Bool,
        isPackage: Bool,
        fileSize: Int?,
        modificationDate: Date?
    ) {
        self.id = cachedPath
        self.url = URL(fileURLWithPath: cachedPath)
        self.name = name
        self.isDirectory = isDirectory
        self.isPackage = isPackage
        self.fileSize = fileSize
        self.modificationDate = modificationDate
        if isDirectory && !isPackage {
            self.children = []
        } else {
            self.children = nil
        }
    }

    // MARK: - Ignore Patterns

    /// Returns true if the filename matches any of the given ignore patterns.
    private static func shouldIgnore(_ filename: String, patterns: [String]) -> Bool {
        for pattern in patterns {
            if fnmatch(pattern, filename, 0) == 0 {
                return true
            }
        }
        return false
    }

    // MARK: - Child Loading

    /// Loads and sorts children for a directory URL.
    ///
    /// Directories are listed first (sorted alphabetically), followed by files
    /// (sorted alphabetically). Hidden files (starting with `.`) are included
    /// so that `.claude` and other dotfiles are visible.
    public static func loadChildren(
        for url: URL,
        ignorePatterns: [String] = [],
        packageExtensions: Set<String> = []
    ) -> [FileTreeNode] {
        let fileManager = FileManager.default
        guard let contents = try? fileManager.contentsOfDirectory(
            at: url,
            includingPropertiesForKeys: [.isDirectoryKey, .fileSizeKey, .contentModificationDateKey],
            options: [] // No options — include hidden files so .claude is visible
        ) else {
            return []
        }

        let nodes = contents.compactMap { childURL -> FileTreeNode? in
            let filename = childURL.lastPathComponent

            // Skip .DS_Store files
            if filename == ".DS_Store" {
                return nil
            }

            // Skip files matching ignore patterns
            if shouldIgnore(filename, patterns: ignorePatterns) {
                return nil
            }

            let resourceValues = try? childURL.resourceValues(forKeys: [.isDirectoryKey])
            let isDir = resourceValues?.isDirectory ?? false
            return FileTreeNode(
                url: childURL,
                isDirectory: isDir,
                loadChildren: true,
                ignorePatterns: ignorePatterns,
                packageExtensions: packageExtensions
            )
        }

        // Sort: directories first, then alphabetically (case-insensitive)
        return nodes.sorted { lhs, rhs in
            if lhs.isDirectory != rhs.isDirectory {
                return lhs.isDirectory
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    /// Builds a complete file tree sequentially from a root directory URL.
    public static func buildTree(
        from rootURL: URL,
        ignorePatterns: [String] = [],
        packageExtensions: Set<String> = []
    ) -> FileTreeNode {
        return FileTreeNode(
            url: rootURL,
            isDirectory: true,
            loadChildren: true,
            ignorePatterns: ignorePatterns,
            packageExtensions: packageExtensions
        )
    }

    /// Builds a file tree with parallel scanning of top-level directories.
    public static func buildTreeParallel(
        from rootURL: URL,
        ignorePatterns: [String],
        packageExtensions: Set<String>,
        operationQueue: OperationQueue
    ) -> FileTreeNode {
        let rootNode = FileTreeNode(
            url: rootURL,
            isDirectory: true,
            loadChildren: false,
            packageExtensions: packageExtensions
        )

        let fileManager = FileManager.default
        guard let contents = try? fileManager.contentsOfDirectory(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: []
        ) else {
            rootNode.children = []
            return rootNode
        }

        // Separate directories from files, filtering by ignore patterns
        var topLevelDirs: [(index: Int, url: URL)] = []
        var fileNodes: [FileTreeNode] = []
        var sortIndex = 0

        for childURL in contents {
            let filename = childURL.lastPathComponent
            if filename == ".DS_Store" { continue }
            if shouldIgnore(filename, patterns: ignorePatterns) { continue }

            let resourceValues = try? childURL.resourceValues(forKeys: [.isDirectoryKey])
            let isDir = resourceValues?.isDirectory ?? false

            if isDir {
                topLevelDirs.append((index: sortIndex, url: childURL))
            } else {
                fileNodes.append(FileTreeNode(
                    url: childURL,
                    isDirectory: false,
                    packageExtensions: packageExtensions
                ))
            }
            sortIndex += 1
        }

        // Dispatch each top-level directory to the operation queue
        let lock = NSLock()
        nonisolated(unsafe) var dirResults: [(url: URL, node: FileTreeNode)] = []

        for (_, dirURL) in topLevelDirs {
            let op = BlockOperation {
                let node = FileTreeNode(
                    url: dirURL,
                    isDirectory: true,
                    loadChildren: true,
                    ignorePatterns: ignorePatterns,
                    packageExtensions: packageExtensions
                )
                lock.lock()
                dirResults.append((url: dirURL, node: node))
                lock.unlock()
            }
            operationQueue.addOperation(op)
        }

        operationQueue.waitUntilAllOperationsAreFinished()

        // Combine directory and file nodes, sort: directories first, then alphabetically
        var allNodes: [FileTreeNode] = dirResults.map(\.node) + fileNodes
        allNodes.sort { lhs, rhs in
            if lhs.isDirectory != rhs.isDirectory {
                return lhs.isDirectory
            }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }

        rootNode.children = allNodes
        return rootNode
    }

    // MARK: - SF Symbol Icons

    /// The SF Symbol name appropriate for this file or directory type.
    public var systemImageName: String {
        if isPackage {
            return "shippingbox.fill"
        }
        if isDirectory {
            return directoryIconName
        }
        return fileIconName
    }

    /// SF Symbol name for directory types, with special cases for known folders.
    private var directoryIconName: String {
        switch name {
        case ".claude":
            return "brain"
        case ".git":
            return "arrow.triangle.branch"
        case "Sources", "Source", "src":
            return "folder.fill.badge.gearshape"
        case "Tests", "test", "tests":
            return "folder.fill.badge.questionmark"
        default:
            if name.hasPrefix(".") {
                return "folder.badge.gearshape"
            }
            return "folder.fill"
        }
    }

    /// SF Symbol name for file types, based on file extension.
    /// Consults user-defined custom file type mappings first.
    private var fileIconName: String {
        let ext = url.pathExtension.lowercased()

        // Task B4 will restore this once CustomFileTypeMappings is moved.
        // if !ext.isEmpty, let custom = CustomFileTypeMappings.mapping(for: ext) {
        //     return custom.iconName
        // }

        switch ext {
        case "swift":
            return "swift"
        case "json":
            return "curlybraces"
        case "md", "markdown":
            return "doc.richtext"
        case "txt", "text":
            return "doc.text"
        case "plist":
            return "list.bullet.rectangle"
        case "xcodeproj", "xcworkspace":
            return "hammer.fill"
        case "entitlements":
            return "lock.shield"
        case "png", "jpg", "jpeg", "gif", "svg", "ico":
            return "photo"
        case "yaml", "yml", "toml":
            return "gearshape.2"
        case "sh", "zsh", "bash":
            return "terminal"
        case "py":
            return "chevron.left.forwardslash.chevron.right"
        case "js", "ts":
            return "chevron.left.forwardslash.chevron.right"
        case "css", "html":
            return "globe"
        case "gitignore":
            return "eye.slash"
        default:
            return "doc"
        }
    }

    // MARK: - Width Calculation

    /// Calculates the estimated display width needed to show the widest visible item
    /// in the tree, accounting for nesting depth, icon, and text length.
    public func maximumDisplayWidth(
        depth: Int = 0,
        characterWidth: CGFloat = 7.5,
        indentPerLevel: CGFloat = 20.0,
        baseWidth: CGFloat = 70.0
    ) -> CGFloat {
        let indent = CGFloat(depth) * indentPerLevel
        let textWidth = CGFloat(name.count) * characterWidth
        let myWidth = baseWidth + indent + textWidth

        guard let children = children else {
            return myWidth
        }

        var maxChildWidth: CGFloat = 0
        for child in children {
            let childWidth = child.maximumDisplayWidth(
                depth: depth + 1,
                characterWidth: characterWidth,
                indentPerLevel: indentPerLevel,
                baseWidth: baseWidth
            )
            maxChildWidth = max(maxChildWidth, childWidth)
        }

        return max(myWidth, maxChildWidth)
    }

    // MARK: - Hashable

    public static func == (lhs: FileTreeNode, rhs: FileTreeNode) -> Bool {
        lhs.id == rhs.id
    }

    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

import Foundation
import Combine
import os
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// Shared coordinator for directory tree scanning and filesystem watching.
///
/// Encapsulates the sync -> watch -> surgical-update lifecycle. All filesystem
/// I/O runs on background queues to avoid blocking the UI, and a sync reads one
/// level: the root's own entries. Everything below that is read when it is
/// shown — see `FileTreeNode.loadChildrenIfNeeded()`.
@MainActor
public final class DirectoryWatchCoordinator: ObservableObject {
    public let rootURL: URL
    public let excludedPrefixes: [String]
    public let config: FileTreeConfig

    /// Wildcard patterns for filenames to exclude from the file tree.
    public var ignorePatterns: [String] = []

    @Published public var rootNode: FileTreeNode?
    @Published public var isSyncing: Bool = false

    private var watcher: FileSystemWatcher?
    private var onChangeCallback: (() -> Void)?

    public init(
        rootURL: URL,
        config: FileTreeConfig,
        excludedPrefixes: [String]
    ) {
        self.rootURL = rootURL
        self.config = config
        self.excludedPrefixes = excludedPrefixes
    }

    /// Reads the root directory and publishes it.
    ///
    /// Only the root's own entries: a directory's contents are read when the
    /// user opens it, so this is one `contentsOfDirectory` however big the
    /// checkout is.
    public func fullSync() {
        isSyncing = true
        let patterns = ignorePatterns
        let pkgExts = config.packageExtensions
        let rootURL = self.rootURL

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let tree = FileTreeNode(
                url: rootURL,
                isDirectory: true,
                loadChildren: true,
                ignorePatterns: patterns,
                packageExtensions: pkgExts
            )

            DispatchQueue.main.async {
                guard let self = self else { return }
                self.rootNode = tree
                self.isSyncing = false
                self.onChangeCallback?()
                self.logger.info("Sync complete for \(self.rootURL.lastPathComponent)")
            }
        }
    }

    /// Starts filesystem watching. Calls onChange after each update.
    public func startWatching(onChange: (() -> Void)? = nil) {
        self.onChangeCallback = onChange
        watcher = FileSystemWatcher(rootPath: rootURL.path, excludedPrefixes: excludedPrefixes) { [weak self] paths in
            Task { @MainActor in
                self?.handleChanges(paths)
            }
        }
        watcher?.start()
    }

    public func stopWatching() {
        watcher?.stop()
        watcher = nil
    }

    /// Handles filesystem change events. Runs surgical updates on a background queue.
    private func handleChanges(_ paths: [String]) {
        logger.debug("FS changes: \(paths.count) path(s) in \(self.rootURL.lastPathComponent)")

        // A change that lands before the first sync has published a tree is
        // already covered by that sync — and clearing `isSyncing` here would
        // take the spinner down while it is still running, leaving the pane
        // claiming the directory is empty.
        guard let root = rootNode else { return }
        isSyncing = true

        // Collect affected directories
        var affectedDirs = Set<String>()
        for path in paths {
            affectedDirs.insert((path as NSString).deletingLastPathComponent)
        }

        // Build the path index on main (it's just pointer traversal, fast)
        var nodeIndex: [String: FileTreeNode] = [:]
        buildIndex(node: root, into: &nodeIndex)

        // Find the nodes that need updating
        let nodesToUpdate: [(FileTreeNode, URL)] = affectedDirs.compactMap { dirPath in
            guard let parentNode = nodeIndex[dirPath], parentNode.isDirectory else { return nil }
            return (parentNode, parentNode.url)
        }

        let patterns = ignorePatterns
        let pkgExts = config.packageExtensions

        // Do the filesystem I/O on a background queue
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            // Load new children for each affected directory (this hits the filesystem)
            let updates: [(FileTreeNode, [FileTreeNode])] = nodesToUpdate.map { (node, url) in
                let newChildren = FileTreeNode.loadChildren(
                    for: url,
                    ignorePatterns: patterns,
                    packageExtensions: pkgExts
                )
                return (node, newChildren)
            }

            DispatchQueue.main.async {
                guard let self = self else { return }

                // Apply the updates on main thread (just pointer swaps).
                // Merged, not replaced: a fresh read hands back unread child
                // directories, and swapping those in would collapse whatever
                // the user had open below the directory that changed.
                for (node, newChildren) in updates {
                    node.merge(children: newChildren)
                }

                self.isSyncing = false
                self.onChangeCallback?()
            }
        }
    }

    private func buildIndex(node: FileTreeNode, into index: inout [String: FileTreeNode]) {
        index[node.url.path] = node
        if let children = node.children {
            for child in children {
                buildIndex(node: child, into: &index)
            }
        }
    }
}

extension DirectoryWatchCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}

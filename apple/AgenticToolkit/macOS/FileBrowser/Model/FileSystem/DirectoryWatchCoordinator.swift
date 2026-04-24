import Foundation
import Combine
import os

/// Shared coordinator for directory tree scanning, caching, and filesystem watching.
///
/// Encapsulates the cache-load -> full-sync -> watch -> surgical-update lifecycle.
/// All filesystem I/O runs on background queues to avoid blocking the UI.
/// Top-level directories are scanned in parallel via an `OperationQueue` whose
/// concurrency is controlled by `config.maxScanWorkersDefaultsKey`.
@MainActor
public final class DirectoryWatchCoordinator: ObservableObject {
    public let rootURL: URL
    public let cacheStorageURL: URL
    public let excludedPrefixes: [String]
    public let config: FileTreeConfig

    /// Wildcard patterns for filenames to exclude from the file tree.
    public var ignorePatterns: [String] = []

    @Published public var rootNode: FileTreeNode?
    @Published public var isSyncing: Bool = false

    private var watcher: FileSystemWatcher?
    private var onChangeCallback: (() -> Void)?

    /// Operation queue for parallel directory scanning.
    /// Concurrency is updated from `config.maxScanWorkersDefaultsKey` at each sync.
    private lazy var scanQueue: OperationQueue = {
        let queue = OperationQueue()
        queue.name = "com.agentictoolkit.filebrowser.scan"
        queue.qualityOfService = .userInitiated
        return queue
    }()

    public init(
        rootURL: URL,
        cacheStorageURL: URL,
        config: FileTreeConfig,
        excludedPrefixes: [String]
    ) {
        self.rootURL = rootURL
        self.cacheStorageURL = cacheStorageURL
        self.config = config
        self.excludedPrefixes = excludedPrefixes
    }

    /// Loads cached tree for instant display, then full syncs in background.
    public func loadInitial() {
        isSyncing = true

        // Load cache on background queue to avoid blocking UI
        let storageURL = cacheStorageURL
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let cached = FileTreeCache.load(from: storageURL)
            DispatchQueue.main.async {
                guard let self = self else { return }
                if let cached = cached {
                    self.rootNode = cached
                    self.logger.info("Loaded cached tree for \(self.rootURL.lastPathComponent)")
                }
                self.fullSync()
            }
        }
    }

    /// Rebuilds the entire tree from filesystem in the background.
    /// Top-level directories are scanned in parallel.
    public func fullSync() {
        isSyncing = true
        let patterns = ignorePatterns
        let pkgExts = config.packageExtensions
        let rootURL = self.rootURL
        let storageURL = self.cacheStorageURL
        let queue = self.scanQueue

        // Update concurrency from config-driven setting
        let maxWorkers = UserDefaults.standard.integer(forKey: config.maxScanWorkersDefaultsKey)
        queue.maxConcurrentOperationCount = maxWorkers > 0 ? maxWorkers : 3

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            let tree = FileTreeNode.buildTreeParallel(
                from: rootURL,
                ignorePatterns: patterns,
                packageExtensions: pkgExts,
                operationQueue: queue
            )

            DispatchQueue.main.async {
                guard let self = self else { return }
                self.rootNode = tree
                self.isSyncing = false
                self.onChangeCallback?()
                self.logger.info("Full sync complete for \(self.rootURL.lastPathComponent)")
            }

            // Save cache on background queue (fire-and-forget)
            FileTreeCache.save(rootNode: tree, to: storageURL)
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
        scanQueue.cancelAllOperations()
        watcher?.stop()
        watcher = nil
        if let root = rootNode {
            let storageURL = cacheStorageURL
            DispatchQueue.global(qos: .utility).async {
                FileTreeCache.save(rootNode: root, to: storageURL)
            }
        }
    }

    /// Handles filesystem change events. Runs surgical updates on a background queue.
    private func handleChanges(_ paths: [String]) {
        logger.debug("FS changes: \(paths.count) path(s) in \(self.rootURL.lastPathComponent)")
        isSyncing = true

        guard let root = rootNode else {
            isSyncing = false
            return
        }

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
        let storageURL = cacheStorageURL

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

                // Apply the updates on main thread (just pointer swaps)
                for (node, newChildren) in updates {
                    node.children = newChildren
                }

                self.isSyncing = false
                self.onChangeCallback?()
            }

            // Save cache in background
            FileTreeCache.save(rootNode: root, to: storageURL)
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

public extension DirectoryWatchCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}

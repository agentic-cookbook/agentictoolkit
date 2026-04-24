import AgenticToolkitCore
import Combine
import Foundation
import os

/// An entry in a multi-directory workspace.
///
/// The framework watches entries of type `.directory` for package-extension
/// matches. `.project` entries are pass-through (the host app manages them).
public struct WorkspaceEntry: Codable, Identifiable, Equatable, Sendable {
    public enum EntryType: String, Codable, CaseIterable, Sendable {
        case project
        case directory
    }

    public var id: Int
    public var type: EntryType
    public var path: String
    public var name: String
    public var addedDate: Date

    public init(id: Int, type: EntryType, path: String, name: String, addedDate: Date) {
        self.id = id
        self.type = type
        self.path = path
        self.name = name
        self.addedDate = addedDate
    }
}

/// A project package discovered by `WorkspaceDirectoryManager` while scanning
/// a directory entry.
public struct DiscoveredProject: Codable, Identifiable, Equatable, Sendable {
    public var id: Int
    public var entryID: Int
    public var projectPath: String
    public var projectName: String
    public var lastSeen: Date

    public init(id: Int, entryID: Int, projectPath: String, projectName: String, lastSeen: Date) {
        self.id = id
        self.entryID = entryID
        self.projectPath = projectPath
        self.projectName = projectName
        self.lastSeen = lastSeen
    }
}

@MainActor
public final class WorkspaceDirectoryManager: ObservableObject {
    @Published public var isSyncing: Bool = false
    @Published public var discoveredProjects: [DiscoveredProject] = []

    /// Called whenever discovered projects change for an entry, so the host can persist them.
    public var onDiscoveryChanged: ((_ entryID: Int, _ projects: [DiscoveredProject]) -> Void)?

    private let workspacePackageURL: URL
    private let config: FileTreeConfig
    private var coordinators: [Int: DirectoryWatchCoordinator] = [:] // keyed by entry ID
    private var nextDiscoveredID = 1
    private var syncCancellables = Set<AnyCancellable>()

    public init(workspacePackageURL: URL, config: FileTreeConfig) {
        self.workspacePackageURL = workspacePackageURL
        self.config = config
    }

    /// Seeds the next discovered project ID from existing data to avoid collisions.
    public func seedFromExistingDiscoveries(_ existing: [DiscoveredProject]) {
        let maxID = existing.map(\.id).max() ?? 0
        nextDiscoveredID = maxID + 1
        discoveredProjects = existing
    }

    public func syncEntries(_ entries: [WorkspaceEntry]) {
        // Remove coordinators for entries that no longer exist
        let currentIDs = Set(entries.filter { $0.type == .directory }.map(\.id))
        for id in coordinators.keys where !currentIDs.contains(id) {
            coordinators[id]?.stopWatching()
            coordinators.removeValue(forKey: id)
        }

        // Add coordinators for new directory entries
        let packageURL = workspacePackageURL
        for entry in entries where entry.type == .directory {
            if coordinators[entry.id] == nil {
                let cacheDir = packageURL.appendingPathComponent("cache-\(entry.id)")

                // Create cache directory on background queue
                DispatchQueue.global(qos: .utility).async {
                    try? FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
                }

                let coordinator = DirectoryWatchCoordinator(
                    rootURL: URL(fileURLWithPath: entry.path),
                    cacheStorageURL: cacheDir,
                    config: config,
                    excludedPrefixes: [packageURL.path]
                )
                coordinators[entry.id] = coordinator
            }
        }

        // Re-observe all coordinators' syncing state
        observeSyncingState()
    }

    public func startWatchingAll() {
        for (entryID, coordinator) in coordinators {
            coordinator.loadInitial()
            coordinator.startWatching { [weak self] in
                self?.scanForProjects(entryID: entryID, coordinator: coordinator)
                self?.updateSyncingState()
            }
            scanForProjects(entryID: entryID, coordinator: coordinator)
        }
        updateSyncingState()
    }

    public func stopWatchingAll() {
        for coordinator in coordinators.values {
            coordinator.stopWatching()
        }
    }

    public func isSyncingEntry(_ entryID: Int) -> Bool {
        coordinators[entryID]?.isSyncing ?? false
    }

    private func scanForProjects(entryID: Int, coordinator: DirectoryWatchCoordinator) {
        guard let root = coordinator.rootNode else { return }

        // Run tree traversal on background queue
        let currentNextID = nextDiscoveredID
        let pkgExts = config.packageExtensions
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            var found: [DiscoveredProject] = []
            var nextID = currentNextID
            Self.scanNode(
                root,
                entryID: entryID,
                packageExtensions: pkgExts,
                nextID: &nextID,
                into: &found
            )

            let capturedFound = found
            let capturedNextID = nextID
            Task { @MainActor in
                guard let self = self else { return }
                self.nextDiscoveredID = capturedNextID
                self.discoveredProjects.removeAll { $0.entryID == entryID }
                self.discoveredProjects.append(contentsOf: capturedFound)

                self.onDiscoveryChanged?(entryID, capturedFound)

                self.logger.info("Discovered \(capturedFound.count) project(s) in entry \(entryID)")
            }
        }
    }

    private nonisolated static func scanNode(
        _ node: FileTreeNode,
        entryID: Int,
        packageExtensions: Set<String>,
        nextID: inout Int,
        into results: inout [DiscoveredProject]
    ) {
        if node.isPackage && packageExtensions.contains(node.url.pathExtension) {
            let dp = DiscoveredProject(
                id: nextID,
                entryID: entryID,
                projectPath: node.url.path,
                projectName: node.url.deletingPathExtension().lastPathComponent,
                lastSeen: Date()
            )
            nextID += 1
            results.append(dp)
            return // don't recurse into packages
        }
        if let children = node.children {
            for child in children {
                scanNode(
                    child,
                    entryID: entryID,
                    packageExtensions: packageExtensions,
                    nextID: &nextID,
                    into: &results
                )
            }
        }
    }

    /// Observes all coordinators' `$isSyncing` publishers and aggregates into `isSyncing`.
    private func observeSyncingState() {
        syncCancellables.removeAll()
        for coordinator in coordinators.values {
            coordinator.$isSyncing
                .receive(on: DispatchQueue.main)
                .sink { [weak self] _ in
                    self?.updateSyncingState()
                }
                .store(in: &syncCancellables)
        }
    }

    private func updateSyncingState() {
        isSyncing = coordinators.values.contains { $0.isSyncing }
    }
}

public extension WorkspaceDirectoryManager: Loggable {
    public static nonisolated let logger = makeLogger()
}

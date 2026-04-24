import Foundation
import os

public struct FileTreeCacheEntry: Codable, Sendable {
    public let path: String
    public let parentPath: String?
    public let name: String
    public let isDirectory: Bool
    public let isPackage: Bool
    public let fileSize: Int?
    public let modificationDate: Date?

    public init(
        path: String,
        parentPath: String?,
        name: String,
        isDirectory: Bool,
        isPackage: Bool,
        fileSize: Int?,
        modificationDate: Date?
    ) {
        self.path = path
        self.parentPath = parentPath
        self.name = name
        self.isDirectory = isDirectory
        self.isPackage = isPackage
        self.fileSize = fileSize
        self.modificationDate = modificationDate
    }
}

public enum FileTreeCache {
    public static let cacheFilename = "file-tree-cache.json"

    public static func save(rootNode: FileTreeNode, to packageURL: URL) {
        // Flatten tree to array, encode as JSON, write to packageURL/file-tree-cache.json
        // Run on background queue, fire-and-forget.
        DispatchQueue.global(qos: .utility).async {
            do {
                var entries: [FileTreeCacheEntry] = []
                flattenTree(node: rootNode, parentPath: nil, into: &entries)
                let encoder = JSONEncoder()
                encoder.dateEncodingStrategy = .iso8601
                let data = try encoder.encode(entries)
                let cacheURL = packageURL.appendingPathComponent(cacheFilename)
                try data.write(to: cacheURL, options: .atomic)
                logger.debug("Wrote file tree cache: \(entries.count) entries")
            } catch {
                logger.error("Failed to write file tree cache: \(error.localizedDescription)")
            }
        }
    }

    public static func load(from packageURL: URL) -> FileTreeNode? {
        // Read cache file, decode entries, reconstruct tree
        let cacheURL = packageURL.appendingPathComponent(cacheFilename)
        guard let data = try? Data(contentsOf: cacheURL) else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let entries = try? decoder.decode([FileTreeCacheEntry].self, from: data),
              !entries.isEmpty else { return nil }

        // Build nodes
        var nodeMap: [String: FileTreeNode] = [:]
        for entry in entries {
            let node = FileTreeNode(
                cachedPath: entry.path, name: entry.name,
                isDirectory: entry.isDirectory, isPackage: entry.isPackage,
                fileSize: entry.fileSize, modificationDate: entry.modificationDate
            )
            nodeMap[entry.path] = node
        }

        // Wire parent-child relationships
        for entry in entries {
            guard let parentPath = entry.parentPath,
                  let parent = nodeMap[parentPath],
                  let child = nodeMap[entry.path] else { continue }
            if parent.children == nil { parent.children = [] }
            parent.children?.append(child)
        }

        // Find root (entry with nil parentPath)
        let root = entries.first(where: { $0.parentPath == nil }).flatMap { nodeMap[$0.path] }
        logger.info("Loaded file tree cache: \(entries.count) entries")
        return root
    }

    private static func flattenTree(node: FileTreeNode, parentPath: String?, into entries: inout [FileTreeCacheEntry]) {
        entries.append(FileTreeCacheEntry(
            path: node.url.path,
            parentPath: parentPath,
            name: node.name,
            isDirectory: node.isDirectory,
            isPackage: node.isPackage,
            fileSize: node.fileSize,
            modificationDate: node.modificationDate
        ))
        if let children = node.children {
            for child in children {
                flattenTree(node: child, parentPath: node.url.path, into: &entries)
            }
        }
    }
}

extension FileTreeCache: Loggable {
    public static nonisolated let logger = makeLogger()
}

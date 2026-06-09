import Foundation
import os.log

/// Errors that can occur during context persistence operations.
public enum SystemWindowContextStoreError: Error, LocalizedError {
    case directoryCreationFailed(path: String, underlying: Error)
    case encodingFailed(underlying: Error)
    case decodingFailed(path: String, underlying: Error)
    case writeFailed(path: String, underlying: Error)
    case readFailed(path: String, underlying: Error)
    case lockAcquisitionFailed(path: String)
    case contextNotFound(id: UUID)

    public var errorDescription: String? {
        switch self {
        case .directoryCreationFailed(let path, let underlying):
            return "Failed to create directory at \(path): \(underlying.localizedDescription)"
        case .encodingFailed(let underlying):
            return "Failed to encode data: \(underlying.localizedDescription)"
        case .decodingFailed(let path, let underlying):
            return "Failed to decode data at \(path): \(underlying.localizedDescription)"
        case .writeFailed(let path, let underlying):
            return "Failed to write file at \(path): \(underlying.localizedDescription)"
        case .readFailed(let path, let underlying):
            return "Failed to read file at \(path): \(underlying.localizedDescription)"
        case .lockAcquisitionFailed(let path):
            return "Failed to acquire file lock at \(path)"
        case .contextNotFound(let id):
            return "Context not found: \(id)"
        }
    }
}

/// Reads and writes system-window context state to disk.
///
/// State is persisted under the supplied root directory:
/// ```
/// <root>/
///   state.json          — contexts state (active context ID, context order)
///   contexts/
///     <uuid>.json       — one file per SystemWindowContext
/// ```
///
/// All write operations use file-level locking via `flock(2)` to prevent
/// concurrent write corruption. Reads are unlocked for performance. Hence the
/// `@unchecked Sendable` conformance — the safety invariant is enforced by the
/// lock, and the JSON coders are configured once and used read-only.
public final class SystemWindowContextStore: @unchecked Sendable, Loggable {

    public static nonisolated let logger = makeLogger()

    /// The root directory for all context state files.
    public let rootDirectory: URL

    /// Path to the state file.
    public var stateFilePath: URL {
        rootDirectory.appendingPathComponent("state.json")
    }

    /// Path to the contexts directory.
    public var contextsDirectory: URL {
        rootDirectory.appendingPathComponent("contexts")
    }

    /// Path to the lock file used for write serialization.
    public var lockFilePath: URL {
        rootDirectory.appendingPathComponent(".lock")
    }

    /// Shared JSON encoder configured for human-readable output.
    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    /// Shared JSON decoder.
    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }()

    /// Creates a store targeting the given root directory.
    ///
    /// - Parameter rootDirectory: The directory where state files are stored.
    public init(rootDirectory: URL) {
        self.rootDirectory = rootDirectory
        Self.logger.info("SystemWindowContextStore initialized at \(self.rootDirectory.path)")
    }

    // MARK: - Directory Setup

    /// Creates the directory structure if it doesn't exist.
    public func ensureDirectoryStructure() throws {
        let fileManager = FileManager.default

        do {
            try fileManager.createDirectory(
                at: rootDirectory,
                withIntermediateDirectories: true,
                attributes: nil
            )
            try fileManager.createDirectory(
                at: contextsDirectory,
                withIntermediateDirectories: true,
                attributes: nil
            )
        } catch {
            throw SystemWindowContextStoreError.directoryCreationFailed(
                path: rootDirectory.path,
                underlying: error
            )
        }
    }

    // MARK: - File Locking

    /// Executes a closure while holding an exclusive file lock.
    private func withFileLock<T>(_ body: () throws -> T) throws -> T {
        try ensureDirectoryStructure()

        let lockPath = lockFilePath.path
        let fileDescriptor = open(lockPath, O_CREAT | O_RDWR, 0o644)
        guard fileDescriptor >= 0 else {
            throw SystemWindowContextStoreError.lockAcquisitionFailed(path: lockPath)
        }

        // Acquire the lock BEFORE registering the unlock/close defer, so a failed flock
        // closes the descriptor exactly once (the previous ordering closed it here and
        // again in the defer — a double close that can clobber an unrelated recycled fd).
        guard flock(fileDescriptor, LOCK_EX) == 0 else {
            close(fileDescriptor)
            throw SystemWindowContextStoreError.lockAcquisitionFailed(path: lockPath)
        }

        defer {
            flock(fileDescriptor, LOCK_UN)
            close(fileDescriptor)
        }

        return try body()
    }

    // MARK: - Contexts State

    /// Loads the contexts state from state.json.
    ///
    /// Returns a default empty state if the file doesn't exist yet.
    public func loadState() throws -> SystemWindowContextsState {
        let path = stateFilePath

        guard FileManager.default.fileExists(atPath: path.path) else {
            return SystemWindowContextsState()
        }

        let data: Data
        do {
            data = try Data(contentsOf: path)
        } catch {
            throw SystemWindowContextStoreError.readFailed(path: path.path, underlying: error)
        }

        do {
            return try decoder.decode(SystemWindowContextsState.self, from: data)
        } catch {
            throw SystemWindowContextStoreError.decodingFailed(path: path.path, underlying: error)
        }
    }

    // MARK: - Context Files

    /// Returns the file path for a context with the given ID.
    public func contextFilePath(for id: UUID) -> URL {
        contextsDirectory.appendingPathComponent("\(id.uuidString).json")
    }

    /// Loads a single context from its JSON file.
    public func loadContext(id: UUID) throws -> SystemWindowContext {
        let path = contextFilePath(for: id)

        guard FileManager.default.fileExists(atPath: path.path) else {
            throw SystemWindowContextStoreError.contextNotFound(id: id)
        }

        let data: Data
        do {
            data = try Data(contentsOf: path)
        } catch {
            throw SystemWindowContextStoreError.readFailed(path: path.path, underlying: error)
        }

        do {
            return try decoder.decode(SystemWindowContext.self, from: data)
        } catch {
            throw SystemWindowContextStoreError.decodingFailed(path: path.path, underlying: error)
        }
    }

    /// Saves a single context to its JSON file with file locking.
    public func saveContext(_ context: SystemWindowContext) throws {
        try withFileLock {
            try ensureDirectoryStructure()

            let data: Data
            do {
                data = try encoder.encode(context)
            } catch {
                throw SystemWindowContextStoreError.encodingFailed(underlying: error)
            }

            let path = contextFilePath(for: context.id)
            do {
                try data.write(to: path, options: .atomic)
            } catch {
                throw SystemWindowContextStoreError.writeFailed(path: path.path, underlying: error)
            }
        }
    }

    /// Deletes a context's JSON file from disk.
    public func deleteContext(id: UUID) throws {
        try withFileLock {
            let path = contextFilePath(for: id)
            let fileManager = FileManager.default

            if fileManager.fileExists(atPath: path.path) {
                try fileManager.removeItem(at: path)
            }
        }
    }

    // MARK: - Bulk Operations

    /// Loads all contexts referenced by the persisted state, in order.
    ///
    /// Contexts whose files are missing are skipped.
    public func loadAllContexts() throws -> [SystemWindowContext] {
        let state = try loadState()
        var contexts: [SystemWindowContext] = []

        for id in state.contextIDs {
            do {
                let context = try loadContext(id: id)
                contexts.append(context)
            } catch {
                // Skip a missing, unreadable, or corrupt context file rather than failing
                // the whole load — one bad file must not wipe every other context.
                Self.logger.error("Skipping context \(id): \(error.localizedDescription)")
                continue
            }
        }

        return contexts
    }

    /// Saves all contexts and updates the contexts state atomically.
    public func saveAll(contexts: [SystemWindowContext], activeContextID: UUID?) throws {
        try withFileLock {
            try ensureDirectoryStructure()

            // Save each context file
            for context in contexts {
                let data: Data
                do {
                    data = try encoder.encode(context)
                } catch {
                    throw SystemWindowContextStoreError.encodingFailed(underlying: error)
                }

                let path = contextFilePath(for: context.id)
                do {
                    try data.write(to: path, options: .atomic)
                } catch {
                    throw SystemWindowContextStoreError.writeFailed(path: path.path, underlying: error)
                }
            }

            // Save contexts state
            let state = SystemWindowContextsState(
                activeContextID: activeContextID,
                contextIDs: contexts.map(\.id)
            )

            let stateData: Data
            do {
                stateData = try encoder.encode(state)
            } catch {
                throw SystemWindowContextStoreError.encodingFailed(underlying: error)
            }

            do {
                try stateData.write(to: stateFilePath, options: .atomic)
            } catch {
                throw SystemWindowContextStoreError.writeFailed(
                    path: stateFilePath.path, underlying: error)
            }
        }
    }

    /// Lists all context JSON files in the contexts directory.
    public func listContextFiles() throws -> [UUID] {
        let fileManager = FileManager.default

        guard fileManager.fileExists(atPath: contextsDirectory.path) else {
            return []
        }

        let contents: [String]
        do {
            contents = try fileManager.contentsOfDirectory(atPath: contextsDirectory.path)
        } catch {
            throw SystemWindowContextStoreError.readFailed(
                path: contextsDirectory.path, underlying: error)
        }

        return contents.compactMap { filename -> UUID? in
            guard filename.hasSuffix(".json") else { return nil }
            let uuidString = String(filename.dropLast(5)) // Remove .json
            return UUID(uuidString: uuidString)
        }
    }

    /// Removes all state files and directories.
    public func removeAll() throws {
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: rootDirectory.path) {
            try fileManager.removeItem(at: rootDirectory)
        }
    }
}

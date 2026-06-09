import Foundation

/// Persists user-defined heuristic rules to a `heuristics.json` file.
///
/// This store manages the lifecycle of custom heuristic rules separately from
/// the main application state. Rules are loaded at startup and registered with
/// the HeuristicRegistry so they participate in fingerprinting and re-matching.
///
/// The storage location is supplied by the caller, so the toolkit does not
/// hardcode any application-specific directory.
public final class CustomHeuristicStore {

    /// The directory where heuristics.json is stored.
    public let rootDirectory: URL

    /// Path to the heuristics JSON file.
    public var heuristicsFilePath: URL {
        rootDirectory.appendingPathComponent("heuristics.json")
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

    /// Creates a CustomHeuristicStore targeting the given root directory.
    ///
    /// - Parameter rootDirectory: The directory in which `heuristics.json` lives.
    public init(rootDirectory: URL) {
        self.rootDirectory = rootDirectory
    }

    /// Loads all custom heuristic rules from disk.
    ///
    /// Returns an empty array if the file doesn't exist yet.
    public func loadRules() throws -> [CustomHeuristicRule] {
        let path = heuristicsFilePath

        guard FileManager.default.fileExists(atPath: path.path) else {
            return []
        }

        let data = try Data(contentsOf: path)
        return try decoder.decode([CustomHeuristicRule].self, from: data)
    }

    /// Saves all custom heuristic rules to disk.
    ///
    /// Creates the directory structure if needed.
    public func saveRules(_ rules: [CustomHeuristicRule]) throws {
        let fileManager = FileManager.default
        if !fileManager.fileExists(atPath: rootDirectory.path) {
            try fileManager.createDirectory(
                at: rootDirectory,
                withIntermediateDirectories: true,
                attributes: nil
            )
        }

        let data = try encoder.encode(rules)
        try data.write(to: heuristicsFilePath, options: .atomic)
    }

    /// Removes the heuristics file from disk.
    ///
    /// Used primarily for testing cleanup.
    public func removeAll() throws {
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: heuristicsFilePath.path) {
            try fileManager.removeItem(at: heuristicsFilePath)
        }
    }
}

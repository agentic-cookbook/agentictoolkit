import Foundation
import os
import AgenticToolkitCore
import OSLog

/// Discovers, loads, and manages LLM plugin bundles.
///
/// Plugins are macOS `.aiplugin` bundles containing a principal class that
/// conforms to `AIPlugin`. The manager reads `Info.plist` metadata at
/// discovery time (cheap) and only loads the binary on demand (lazy). All
/// public accessors return protocol types; the concrete storage is internal.
@MainActor
public final class AIPluginManager {

    // MARK: - Properties

    /// Info records for every discovered plugin. Binaries are not yet loaded.
    public var availablePlugins: [any AIPluginInfo] { records }

    /// Internal storage. Kept as the concrete type so the manager can read
    /// per-record fields (e.g. `bundlePath`) without downcasting.
    private var records: [AIPluginRecord] = []

    /// Loaded plugin instances, keyed by identifier.
    private var loadedPlugins: [String: any AIPlugin] = [:]

    /// Loaded bundles, keyed by identifier (kept alive so the binary stays mapped).
    private var loadedBundles: [String: Bundle] = [:]

    /// Directories to scan for `.aiplugin` bundles.
    private let searchPaths: [URL]

    /// App name used for the per-plugin data directory.
    private let appName: String

    // MARK: - Errors

    public enum AIPluginError: Error, LocalizedError {
        case notFound(String)
        case incompatibleSDK(plugin: String, required: String, found: String)
        case loadFailed(String)
        case noPrincipalClass(String)
        case principalClassNotPlugin(String)

        public var errorDescription: String? {
            switch self {
            case .notFound(let id):
                return "Plugin not found: \(id)"
            case .incompatibleSDK(let plugin, let required, let found):
                return "Plugin '\(plugin)' requires SDK \(found), but current SDK is \(required)"
            case .loadFailed(let id):
                return "Failed to load plugin bundle: \(id)"
            case .noPrincipalClass(let id):
                return "Plugin '\(id)' has no NSPrincipalClass"
            case .principalClassNotPlugin(let id):
                return "Plugin '\(id)' principal class does not conform to AIPlugin"
            }
        }
    }

    // MARK: - Initialization

    /// Creates a plugin manager.
    ///
    /// Default search paths:
    /// - `Contents/PlugIns/` inside the app bundle
    /// - `~/.agenticplugins/`
    /// - `~/Library/Application Support/<appName>/Plugins/`
    public init(appName: String, additionalSearchPaths: [URL] = []) {
        self.appName = appName

        var paths: [URL] = []

        if let builtInPath = Bundle.main.builtInPlugInsURL {
            paths.append(builtInPath)
        }

        paths.append(URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".agenticplugins"))

        if let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            let userPlugins = appSupport.appendingPathComponent(appName).appendingPathComponent("Plugins")
            paths.append(userPlugins)
        }

        paths.append(contentsOf: additionalSearchPaths)
        self.searchPaths = paths
    }

    /// Creates a plugin manager with explicit search paths only (no defaults).
    /// Useful for testing.
    public init(searchPaths: [URL], appName: String = "AgenticPlugins") {
        self.appName = appName
        self.searchPaths = searchPaths
    }

    // MARK: - Discovery

    /// Scans all search paths for `.aiplugin` bundles and reads their metadata.
    /// Does not load any plugin binaries.
    public func discoverPlugins() {
        var discovered: [AIPluginRecord] = []
        let fileManager = FileManager.default

        for searchPath in searchPaths {
            guard fileManager.fileExists(atPath: searchPath.path) else { continue }

            guard let contents = try? fileManager.contentsOfDirectory(
                at: searchPath,
                includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]
            ) else { continue }

            for url in contents where url.pathExtension == "aiplugin" {
                guard let bundle = Bundle(url: url),
                      let record = AIPluginRecord.fromBundle(bundle) else {
                    logger.warning("Skipping invalid plugin bundle: \(url.lastPathComponent, privacy: .public)")
                    continue
                }

                if record.sdkVersion != AIPluginInfoRegistry.currentSDKVersion {
                    // swiftlint:disable:next line_length
                    logger.warning("Skipping incompatible plugin '\(record.displayName, privacy: .public)': SDK \(record.sdkVersion, privacy: .public) != \(AIPluginInfoRegistry.currentSDKVersion, privacy: .public)")
                    continue
                }

                discovered.append(record)
                // swiftlint:disable:next line_length
                logger.info("Discovered plugin: \(record.displayName, privacy: .public) (\(record.identifier, privacy: .public))")
            }
        }

        records.append(contentsOf: discovered)
    }

    // MARK: - Loading

    /// Loads every discovered plugin. Resilient: a failure loading one plugin is
    /// logged and recorded in `failures` without aborting the others.
    public func loadAllPlugins() -> PluginLoadResult {
        var loaded: [any AIPlugin] = []
        var failures: [PluginLoadFailure] = []
        for info in availablePlugins {
            do {
                loaded.append(try loadPlugin(identifier: info.identifier))
            } catch {
                let message = error.localizedDescription
                // swiftlint:disable:next line_length
                logger.error("Failed to load plugin '\(info.displayName, privacy: .public)' (\(info.identifier, privacy: .public)): \(message, privacy: .public)")
                failures.append(
                    PluginLoadFailure(identifier: info.identifier, displayName: info.displayName, message: message)
                )
            }
        }
        return PluginLoadResult(loaded: loaded, failures: failures)
    }

    /// Loads a plugin's binary and instantiates it. Returns a cached instance if already loaded.
    public func loadPlugin(identifier: String) throws -> any AIPlugin {
        if let existing = loadedPlugins[identifier] {
            return existing
        }

        guard let record = records.first(where: { $0.identifier == identifier }) else {
            throw AIPluginError.notFound(identifier)
        }

        if record.sdkVersion != AIPluginInfoRegistry.currentSDKVersion {
            throw AIPluginError.incompatibleSDK(
                plugin: identifier,
                required: AIPluginInfoRegistry.currentSDKVersion,
                found: record.sdkVersion
            )
        }

        guard let bundle = Bundle(url: record.bundlePath) else {
            throw AIPluginError.loadFailed(identifier)
        }

        if !bundle.isLoaded {
            guard bundle.load() else {
                throw AIPluginError.loadFailed(identifier)
            }
        }

        guard let principalClass = bundle.principalClass else {
            throw AIPluginError.noPrincipalClass(identifier)
        }

        guard let pluginClass = principalClass as? any AIPlugin.Type else {
            throw AIPluginError.principalClassNotPlugin(identifier)
        }

        let context = makeContext(for: identifier)
        let instance = pluginClass.init(context: context)

        loadedPlugins[identifier] = instance
        loadedBundles[identifier] = bundle
        logger.info("Loaded plugin: \(record.displayName, privacy: .public)")

        return instance
    }

    /// Unloads a plugin instance (releases the reference).
    /// The bundle remains loaded in memory (macOS does not support unloading bundles).
    public func unloadPlugin(identifier: String) {
        loadedPlugins.removeValue(forKey: identifier)
        logger.info("Unloaded plugin: \(identifier, privacy: .public)")
    }

    // MARK: - Built-in Plugin Registration

    /// Registers a built-in plugin type (compiled into the app, not loaded from a bundle).
    public func registerBuiltIn(_ pluginType: any AIPlugin.Type) {
        let identifier = pluginType.identifier

        guard !records.contains(where: { $0.identifier == identifier }) else { return }

        let context = makeContext(for: identifier)
        let instance = pluginType.init(context: context)

        let record = AIPluginRecord(
            identifier: identifier,
            displayName: instance.displayName,
            version: "built-in",
            sdkVersion: AIPluginInfoRegistry.currentSDKVersion,
            bundlePath: Bundle.main.bundleURL
        )

        records.append(record)
        loadedPlugins[identifier] = instance
        logger.info("Registered built-in plugin: \(instance.displayName, privacy: .public)")
    }

    /// Registers multiple built-in plugin types.
    public func registerBuiltIns(_ pluginTypes: [any AIPlugin.Type]) {
        for pluginType in pluginTypes {
            registerBuiltIn(pluginType)
        }
    }

    // MARK: - Query

    /// Returns info for a plugin without loading it.
    public func info(for identifier: String) -> (any AIPluginInfo)? {
        records.first { $0.identifier == identifier }
    }

    /// Returns a loaded plugin instance, or nil if not loaded.
    public func plugin(for identifier: String) -> (any AIPlugin)? {
        loadedPlugins[identifier]
    }

    // MARK: - Private

    private func makeContext(for identifier: String) -> AIPluginContext {
        let pluginLogger = Logger(subsystem: "com.agentictoolkit.plugin", category: identifier)

        let baseDir: URL
        if let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            baseDir = appSupport
        } else {
            // swiftlint:disable:next line_length
            logger.warning("Application Support directory unavailable; falling back to temporary directory for plugin \(identifier, privacy: .public)")
            baseDir = URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        }

        let dataDir = baseDir
            .appendingPathComponent(appName)
            .appendingPathComponent("Plugins")
            .appendingPathComponent(identifier)

        try? FileManager.default.createDirectory(at: dataDir, withIntermediateDirectories: true)

        return AIPluginContext(logger: pluginLogger, dataDirectory: dataDir)
    }
}

// MARK: - Load result

/// One plugin's load failure: identity + a human-readable reason.
public struct PluginLoadFailure: Sendable {
    public let identifier: String
    public let displayName: String
    public let message: String
}

/// Outcome of loading every discovered plugin: what loaded, and what didn't.
public struct PluginLoadResult {
    public let loaded: [any AIPlugin]
    public let failures: [PluginLoadFailure]
}

// MARK: - Internal record

/// Internal record backing `AIPluginInfo`. Holds the bundle path the
/// manager needs for lazy loading; callers see only the protocol.
private struct AIPluginRecord: AIPluginInfo, Sendable {
    let identifier: String
    let displayName: String
    let version: String
    let sdkVersion: String
    let bundlePath: URL

    static func fromBundle(_ bundle: Bundle) -> AIPluginRecord? {
        guard let info = bundle.infoDictionary,
              let identifier = info["AgenticPluginIdentifier"] as? String,
              let displayName = info["AgenticPluginDisplayName"] as? String,
              let version = info["AgenticPluginVersion"] as? String,
              let sdkVersion = info["AgenticSDKVersion"] as? String else {
            return nil
        }
        return AIPluginRecord(
            identifier: identifier,
            displayName: displayName,
            version: version,
            sdkVersion: sdkVersion,
            bundlePath: bundle.bundleURL
        )
    }
}

extension AIPluginManager: Loggable {
    public static nonisolated let logger = makeLogger()
}

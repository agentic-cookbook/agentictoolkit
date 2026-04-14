import Foundation
import os

/// Discovers, loads, and manages LLM plugin bundles.
///
/// Plugins are macOS `.bundle` files containing a principal class that conforms
/// to `AgenticLLMPlugin`. The manager reads `Info.plist` metadata from each
/// bundle at discovery time (cheap) and only loads the binary on demand (lazy).
public final class PluginManager {

    // MARK: - Properties

    /// Metadata for all discovered plugins (binary not yet loaded).
    public private(set) var availablePlugins: [PluginMetadata] = []

    /// Loaded plugin instances, keyed by identifier.
    private var loadedPlugins: [String: AgenticLLMPlugin] = [:]

    /// Loaded bundles, keyed by identifier (kept alive so the binary stays mapped).
    private var loadedBundles: [String: Bundle] = [:]

    /// Directories to scan for `.bundle` files.
    private let searchPaths: [URL]

    /// App name used for the per-plugin data directory.
    private let appName: String

    private let logger = Logger(subsystem: "com.agenticplugins", category: "PluginManager")

    // MARK: - Errors

    public enum PluginError: Error, LocalizedError {
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
                return "Plugin '\(id)' principal class does not conform to AgenticLLMPlugin"
            }
        }
    }

    // MARK: - Initialization

    /// Creates a plugin manager.
    ///
    /// Default search paths:
    /// - `Contents/PlugIns/` inside the app bundle
    /// - `~/Library/Application Support/<appName>/Plugins/`
    ///
    /// - Parameters:
    ///   - appName: Application name, used for the Application Support subdirectory.
    ///   - additionalSearchPaths: Extra directories to scan for plugin bundles.
    public init(appName: String, additionalSearchPaths: [URL] = []) {
        self.appName = appName

        var paths: [URL] = []

        // App bundle's PlugIns directory
        if let builtInPath = Bundle.main.builtInPlugInsURL {
            paths.append(builtInPath)
        }

        // ~/Library/Application Support/<appName>/Plugins/
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

    /// Scans all search paths for `.bundle` files and reads their metadata.
    /// Does not load any plugin binaries.
    public func discoverPlugins() {
        var discovered: [PluginMetadata] = []
        let fm = FileManager.default

        for searchPath in searchPaths {
            guard fm.fileExists(atPath: searchPath.path) else { continue }

            guard let contents = try? fm.contentsOfDirectory(
                at: searchPath,
                includingPropertiesForKeys: nil,
                options: [.skipsHiddenFiles]
            ) else { continue }

            for url in contents where url.pathExtension == "bundle" {
                guard let bundle = Bundle(url: url),
                      let metadata = PluginMetadata.from(bundle: bundle) else {
                    logger.warning("Skipping invalid plugin bundle: \(url.lastPathComponent, privacy: .public)")
                    continue
                }

                if metadata.sdkVersion != PluginMetadata.currentSDKVersion {
                    logger.warning("Skipping incompatible plugin '\(metadata.displayName, privacy: .public)': SDK \(metadata.sdkVersion, privacy: .public) != \(PluginMetadata.currentSDKVersion, privacy: .public)")
                    continue
                }

                discovered.append(metadata)
                logger.info("Discovered plugin: \(metadata.displayName, privacy: .public) (\(metadata.identifier, privacy: .public))")
            }
        }

        availablePlugins = discovered
    }

    // MARK: - Loading

    /// Loads a plugin's binary and instantiates it. Returns a cached instance if already loaded.
    ///
    /// - Parameter identifier: The plugin's reverse-DNS identifier.
    /// - Returns: The instantiated plugin.
    public func loadPlugin(identifier: String) throws -> AgenticLLMPlugin {
        if let existing = loadedPlugins[identifier] {
            return existing
        }

        guard let metadata = availablePlugins.first(where: { $0.identifier == identifier }) else {
            throw PluginError.notFound(identifier)
        }

        if metadata.sdkVersion != PluginMetadata.currentSDKVersion {
            throw PluginError.incompatibleSDK(
                plugin: identifier,
                required: PluginMetadata.currentSDKVersion,
                found: metadata.sdkVersion
            )
        }

        guard let bundle = Bundle(url: metadata.bundlePath) else {
            throw PluginError.loadFailed(identifier)
        }

        if !bundle.isLoaded {
            guard bundle.load() else {
                throw PluginError.loadFailed(identifier)
            }
        }

        guard let principalClass = bundle.principalClass else {
            throw PluginError.noPrincipalClass(identifier)
        }

        guard let pluginClass = principalClass as? AgenticLLMPlugin.Type else {
            throw PluginError.principalClassNotPlugin(identifier)
        }

        let context = makeContext(for: identifier)
        let instance = pluginClass.init(context: context)

        loadedPlugins[identifier] = instance
        loadedBundles[identifier] = bundle
        logger.info("Loaded plugin: \(metadata.displayName, privacy: .public)")

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
    ///
    /// Use this for providers that ship with the app. The plugin is instantiated immediately
    /// and added to both `availablePlugins` (metadata) and the loaded cache.
    public func registerBuiltIn(_ pluginType: AgenticLLMPlugin.Type) {
        let identifier = pluginType.identifier

        // Skip if already registered
        guard !availablePlugins.contains(where: { $0.identifier == identifier }) else { return }

        let context = makeContext(for: identifier)
        let instance = pluginType.init(context: context)

        let metadata = PluginMetadata(
            identifier: identifier,
            displayName: instance.displayName,
            version: "built-in",
            sdkVersion: PluginMetadata.currentSDKVersion,
            bundlePath: Bundle.main.bundleURL
        )

        availablePlugins.append(metadata)
        loadedPlugins[identifier] = instance
        logger.info("Registered built-in plugin: \(instance.displayName, privacy: .public)")
    }

    /// Registers multiple built-in plugin types.
    public func registerBuiltIns(_ pluginTypes: [AgenticLLMPlugin.Type]) {
        for pluginType in pluginTypes {
            registerBuiltIn(pluginType)
        }
    }

    // MARK: - Query

    /// Returns metadata for a plugin without loading it.
    public func metadata(for identifier: String) -> PluginMetadata? {
        availablePlugins.first { $0.identifier == identifier }
    }

    /// Returns a loaded plugin instance, or nil if not loaded.
    public func plugin(for identifier: String) -> AgenticLLMPlugin? {
        loadedPlugins[identifier]
    }

    // MARK: - Private

    private func makeContext(for identifier: String) -> PluginContext {
        let logger = Logger(subsystem: "com.agenticplugins.plugin", category: identifier)

        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dataDir = appSupport
            .appendingPathComponent(appName)
            .appendingPathComponent("Plugins")
            .appendingPathComponent(identifier)

        try? FileManager.default.createDirectory(at: dataDir, withIntermediateDirectories: true)

        return PluginContext(logger: logger, dataDirectory: dataDir)
    }
}

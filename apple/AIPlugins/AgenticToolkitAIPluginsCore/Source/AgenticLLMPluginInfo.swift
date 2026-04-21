import Foundation

/// Identity and version information about a plugin — available before (and
/// independently of) the plugin's binary being loaded.
public protocol AgenticLLMPluginInfo: Sendable {

    /// Unique reverse-DNS identifier. Matches `AgenticPluginIdentifier` in the
    /// bundle's Info.plist.
    var identifier: String { get }

    /// Human-readable name shown in the UI.
    var displayName: String { get }

    /// Plugin's own version string (e.g. "1.0.0"), or `"built-in"` for plugins
    /// compiled into the host app.
    var version: String { get }

    /// SDK version the plugin was built against. Must equal
    /// `AgenticLLMPluginInfoRegistry.currentSDKVersion` to load.
    var sdkVersion: String { get }
}

/// SDK-version gate used by the host when deciding whether a discovered
/// plugin is loadable.
public enum AgenticLLMPluginInfoRegistry {
    public static let currentSDKVersion = "1"
}

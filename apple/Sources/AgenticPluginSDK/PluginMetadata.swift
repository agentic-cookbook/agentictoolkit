import Foundation

/// Metadata read from a plugin bundle's Info.plist without loading the binary.
public struct PluginMetadata: Sendable {
    public let identifier: String
    public let displayName: String
    public let version: String
    public let sdkVersion: String
    public let bundlePath: URL

    public init(identifier: String, displayName: String, version: String, sdkVersion: String, bundlePath: URL) {
        self.identifier = identifier
        self.displayName = displayName
        self.version = version
        self.sdkVersion = sdkVersion
        self.bundlePath = bundlePath
    }

    /// The current SDK version. Plugins must declare a compatible version to be loaded.
    public static let currentSDKVersion = "1"

    /// Reads metadata from a bundle's Info.plist.
    /// Returns nil if the plist is missing required keys.
    public static func from(bundle: Bundle) -> PluginMetadata? {
        guard let info = bundle.infoDictionary,
              let identifier = info["AgenticPluginIdentifier"] as? String,
              let displayName = info["AgenticPluginDisplayName"] as? String,
              let version = info["AgenticPluginVersion"] as? String,
              let sdkVersion = info["AgenticSDKVersion"] as? String else {
            return nil
        }
        return PluginMetadata(
            identifier: identifier,
            displayName: displayName,
            version: version,
            sdkVersion: sdkVersion,
            bundlePath: bundle.bundleURL
        )
    }
}

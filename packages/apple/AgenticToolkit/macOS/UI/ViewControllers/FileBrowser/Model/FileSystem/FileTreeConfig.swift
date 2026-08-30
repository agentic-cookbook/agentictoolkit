import Foundation

/// Configuration for the AgenticFileBrowser framework.
///
/// Passed into `FileTreeNode`, `DirectoryWatchCoordinator`, `FileTreeManager`,
/// `ContentViewerView`, and `FileTypesSettingsView`.
/// Lets host applications declare which directory extensions represent opaque
/// packages, their human-readable display names, and which `UserDefaults` keys
/// back the framework's settings.
public struct FileTreeConfig: Sendable {
    /// Extensions that identify directories as opaque packages (e.g. `catnip-proj`).
    /// Packages appear as single items in the file tree rather than expanding.
    public let packageExtensions: Set<String>

    /// Optional display names for package extensions, used by `ContentViewerView`.
    /// Keyed by extension, e.g. `["catnip-proj": "Catnip IDE Project Package"]`.
    public let packageDisplayNames: [String: String]

    /// `UserDefaults` key backing `CustomFileTypeMappings` serialization.
    public let customMappingsDefaultsKey: String

    public init(
        packageExtensions: Set<String> = [],
        packageDisplayNames: [String: String] = [:],
        customMappingsDefaultsKey: String = "AgenticFileBrowser.customMappings"
    ) {
        self.packageExtensions = packageExtensions
        self.packageDisplayNames = packageDisplayNames
        self.customMappingsDefaultsKey = customMappingsDefaultsKey
    }

    /// Default configuration with empty package sets and framework-prefixed defaults keys.
    public static let `default` = FileTreeConfig()
}

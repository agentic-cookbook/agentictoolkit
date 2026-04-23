import Foundation

/// Configuration for the AgenticFileBrowser framework.
///
/// Passed into `FileTreeNode`, `DirectoryWatchCoordinator`, `FileTreeManager`,
/// `WorkspaceDirectoryManager`, `ContentViewerView`, and `FileTypesSettingsView`.
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

    /// `UserDefaults` key read by `DirectoryWatchCoordinator` for the maximum
    /// concurrent file-tree scan worker count. Default is 3 when unset.
    public let maxScanWorkersDefaultsKey: String

    public init(
        packageExtensions: Set<String> = [],
        packageDisplayNames: [String: String] = [:],
        customMappingsDefaultsKey: String = "AgenticFileBrowser.customMappings",
        maxScanWorkersDefaultsKey: String = "AgenticFileBrowser.maxScanWorkers"
    ) {
        self.packageExtensions = packageExtensions
        self.packageDisplayNames = packageDisplayNames
        self.customMappingsDefaultsKey = customMappingsDefaultsKey
        self.maxScanWorkersDefaultsKey = maxScanWorkersDefaultsKey
    }

    /// Default configuration with empty package sets and framework-prefixed defaults keys.
    public static let `default` = FileTreeConfig()
}

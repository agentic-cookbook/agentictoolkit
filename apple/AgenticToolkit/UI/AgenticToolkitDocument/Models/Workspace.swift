import AgenticToolkitFileBrowser
import Foundation

/// Settings associated with a workspace.
public struct WorkspaceSettings: Codable, Equatable, Sendable {
    public var sidebarProportion: Double = 0.3

    public init() {}

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let defaults = WorkspaceSettings()
        sidebarProportion = try container.decodeIfPresent(Double.self, forKey: .sidebarProportion) ?? defaults.sidebarProportion
    }
}

/// The top-level model for a workspace package file.
///
/// A workspace aggregates projects and directories for convenient side-by-side
/// navigation. Entries are manually added by the user; discovered projects are
/// auto-populated from directory entries during scanning.
public struct Workspace: Equatable, Sendable {
    public var name: String
    public var version: Int
    public var createdDate: Date
    public var entries: [WorkspaceEntry]
    public var discoveredProjects: [DiscoveredProject]
    public var settings: WorkspaceSettings

    public init(
        name: String,
        version: Int,
        createdDate: Date,
        entries: [WorkspaceEntry],
        discoveredProjects: [DiscoveredProject],
        settings: WorkspaceSettings
    ) {
        self.name = name
        self.version = version
        self.createdDate = createdDate
        self.entries = entries
        self.discoveredProjects = discoveredProjects
        self.settings = settings
    }

    public static func newWorkspace(name: String) -> Workspace {
        Workspace(
            name: name,
            version: 1,
            createdDate: Date(),
            entries: [],
            discoveredProjects: [],
            settings: WorkspaceSettings()
        )
    }
}

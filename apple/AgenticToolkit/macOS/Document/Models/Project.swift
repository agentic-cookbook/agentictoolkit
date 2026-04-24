import Foundation

/// Settings associated with a project.
///
/// Uses a custom `init(from:)` so that missing keys in older project files
/// fall back to defaults instead of throwing decode errors.
public struct ProjectSettings: Codable, Equatable, Sendable {
    /// The default shell path for terminals opened within this project.
    public var defaultShell: String = "/bin/zsh"

    /// Whether to automatically open a terminal session when the project opens.
    public var autoOpenTerminal: Bool = true

    // MARK: - Layout Persistence

    /// Whether the sessions panel on the left is visible.
    public var isSessionPanelVisible: Bool = true

    /// The sessions panel width as a fraction of total window width (0.0–1.0).
    public var sessionPanelProportion: Double = 0.15

    /// The file tree width as a fraction of total window width (0.0–1.0).
    public var fileTreeProportion: Double = 0.20

    /// Whether the file tree sidebar is visible.
    public var isFileTreeVisible: Bool = true

    /// Default layout state for new sessions. Used as the template when creating
    /// a new terminal session within this project.
    public var defaultSessionLayout: TerminalSessionLayoutState = TerminalSessionLayoutState()

    // MARK: - IDE Detection

    /// Cached IDE projects detected in this project's root directory.
    /// Updated automatically when the file tree syncs.
    public var detectedIDEs: [IDEProject] = []

    // MARK: - File Tree

    /// Wildcard patterns for files/directories to hide in the file tree.
    /// Supports `*` (any characters) and `?` (single character) wildcards.
    public var ignorePatterns: [String] = []

    // MARK: - Codable (migration-safe)

    private enum CodingKeys: String, CodingKey {
        case defaultShell, autoOpenTerminal
        case isSessionPanelVisible, sessionPanelProportion, fileTreeProportion
        case isFileTreeVisible, defaultSessionLayout
        case detectedIDEs, ignorePatterns
        // Legacy keys for migration from pre-session-layout projects
        case isFileViewerVisible, isTerminalVisible, detailSplitRatio, isInspectorPresented
    }

    public init() {}

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let defaults = ProjectSettings()
        defaultShell = try container.decodeIfPresent(String.self, forKey: .defaultShell) ?? defaults.defaultShell
        autoOpenTerminal = try container.decodeIfPresent(Bool.self, forKey: .autoOpenTerminal) ?? defaults.autoOpenTerminal
        isSessionPanelVisible = try container.decodeIfPresent(Bool.self, forKey: .isSessionPanelVisible) ?? defaults.isSessionPanelVisible
        sessionPanelProportion = try container.decodeIfPresent(Double.self, forKey: .sessionPanelProportion) ?? defaults.sessionPanelProportion
        fileTreeProportion = try container.decodeIfPresent(Double.self, forKey: .fileTreeProportion) ?? defaults.fileTreeProportion
        isFileTreeVisible = try container.decodeIfPresent(Bool.self, forKey: .isFileTreeVisible) ?? defaults.isFileTreeVisible

        // Migration: read legacy per-session fields into defaultSessionLayout
        if let layout = try container.decodeIfPresent(TerminalSessionLayoutState.self, forKey: .defaultSessionLayout) {
            defaultSessionLayout = layout
        } else {
            let isFileViewerVisible = try container.decodeIfPresent(Bool.self, forKey: .isFileViewerVisible) ?? true
            let isTerminalVisible = try container.decodeIfPresent(Bool.self, forKey: .isTerminalVisible) ?? true
            let isInspectorPresented = try container.decodeIfPresent(Bool.self, forKey: .isInspectorPresented) ?? false
            defaultSessionLayout = .fromLegacy(
                isFileViewerVisible: isFileViewerVisible,
                isTerminalVisible: isTerminalVisible,
                isInspectorPresented: isInspectorPresented
            )
        }
        detectedIDEs = try container.decodeIfPresent([IDEProject].self, forKey: .detectedIDEs) ?? defaults.detectedIDEs
        ignorePatterns = try container.decodeIfPresent([String].self, forKey: .ignorePatterns) ?? defaults.ignorePatterns
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(defaultShell, forKey: .defaultShell)
        try container.encode(autoOpenTerminal, forKey: .autoOpenTerminal)
        try container.encode(isSessionPanelVisible, forKey: .isSessionPanelVisible)
        try container.encode(sessionPanelProportion, forKey: .sessionPanelProportion)
        try container.encode(fileTreeProportion, forKey: .fileTreeProportion)
        try container.encode(isFileTreeVisible, forKey: .isFileTreeVisible)
        try container.encode(defaultSessionLayout, forKey: .defaultSessionLayout)
        try container.encode(detectedIDEs, forKey: .detectedIDEs)
        try container.encode(ignorePatterns, forKey: .ignorePatterns)
    }
}

/// The top-level model for a project package file.
///
/// Contains the project's name, schema version, creation date, and settings.
/// Uses a custom `init(from:)` so that older project files with missing fields
/// decode successfully with defaults.
public struct Project: Codable, Equatable, Sendable {
    /// The human-readable project name.
    public var name: String

    /// Schema version for the project data model.
    ///
    /// Increment this when making breaking changes to the data structure.
    /// Version 1: original JSON format. Version 2+: SQLite storage.
    public var version: Int

    /// The date the project was first created.
    public var createdDate: Date

    /// Project-level settings.
    public var settings: ProjectSettings

    /// Persisted session records with their layout state.
    /// Restored when the project opens; updated when the project saves.
    public var sessionRecords: [TerminalSessionSessionRecord] = []

    /// Creates a new project with sensible defaults.
    public static func newProject(name: String) -> Project {
        Project(
            name: name,
            version: 2,
            createdDate: Date(),
            settings: ProjectSettings()
        )
    }

    // MARK: - Codable (migration-safe)

    public init(name: String, version: Int, createdDate: Date, settings: ProjectSettings) {
        self.name = name
        self.version = version
        self.createdDate = createdDate
        self.settings = settings
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        name = try container.decode(String.self, forKey: .name)
        version = try container.decodeIfPresent(Int.self, forKey: .version) ?? 1
        createdDate = try container.decode(Date.self, forKey: .createdDate)
        settings = try container.decodeIfPresent(ProjectSettings.self, forKey: .settings) ?? ProjectSettings()
    }
}

import Foundation
import AgenticToolkitCore

/// A user's named instance of a provider template: which plugin serves it, which
/// template it was created from, and a display name. The per-configuration field
/// values, model, and secrets live in `UserSetting`s keyed by `id.uuidString`
/// (see `AIProviderConfigStore`); only identity lives here so the ordered list is
/// a small plain-Codable array.
public struct AIProviderConfiguration: Codable, Sendable, Identifiable, Equatable, Hashable {
    public let id: UUID
    public var name: String
    public let pluginIdentifier: String
    public let templateId: String

    public init(id: UUID = UUID(), name: String, pluginIdentifier: String, templateId: String) {
        self.id = id
        self.name = name
        self.pluginIdentifier = pluginIdentifier
        self.templateId = templateId
    }

    /// A configuration name not already in `taken`, appending " 2", " 3", … until
    /// free. One source of truth for the UI (add/rename) and the migration planner.
    public static func uniqueName(_ base: String, avoiding taken: Set<String>) -> String {
        guard taken.contains(base) else { return base }
        var suffix = 2
        while taken.contains("\(base) \(suffix)") { suffix += 1 }
        return "\(base) \(suffix)"
    }
}

@MainActor
extension UserSettings {

    /// The ordered list of configured LLM providers shown in the LLM Providers
    /// settings topic. Routed to the regular (non-secret) store.
    public static let aiProviderConfigurations = UserSetting<[AIProviderConfiguration]>(
        "aiplugin.configurations",
        default: []
    )

    /// The configuration used for AI summaries (and the embedded chat's default).
    /// Empty string == the daemon's zero-config "Default (Claude CLI)" path.
    public static let selectedAIProviderConfigurationId = UserSetting<String>(
        "aiplugin.selectedConfigurationId",
        default: ""
    )

    /// One-time guard: true once legacy per-plugin settings have been migrated
    /// into configurations. See `AIProviderMigration`.
    public static let aiProvidersMigrated = UserSetting<Bool>(
        "aiplugin.migratedToConfigurations",
        default: false
    )

    /// One-time guard: true once the first-run default configuration has been
    /// seeded (see `AIProviderDefaults`). Separate from `aiProvidersMigrated` so
    /// it also seeds on installs that already migrated (and produced nothing).
    public static let aiDefaultConfigSeeded = UserSetting<Bool>(
        "aiplugin.defaultConfigSeeded",
        default: false
    )
}

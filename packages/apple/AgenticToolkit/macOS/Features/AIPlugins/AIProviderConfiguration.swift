import Foundation
import AgenticToolkitCore
import AIPluginKit

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

    /// One-time guard: true once legacy per-plugin settings have been migrated into
    /// configurations. See `AIProviderMigration`.
    public static let aiProvidersMigrated = UserSetting<Bool>(
        "aiplugin.migratedToConfigurations",
        default: false
    )

    /// One-time guard: true once the first-run default configuration has been seeded
    /// (see `AIProviderDefaults`). Separate from `aiProvidersMigrated` so it also
    /// seeds on installs that already migrated (and produced nothing).
    public static let aiDefaultConfigSeeded = UserSetting<Bool>(
        "aiplugin.defaultConfigSeeded",
        default: false
    )
}

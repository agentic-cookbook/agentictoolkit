import Foundation

/// The app→daemon wire contract for AI provider configuration. Replaces the old
/// flattened `[String: Any]` push: carries the WHOLE set of configurations plus a
/// pointer to the active one, so the daemon mirrors the full registry (keyed by
/// configuration identity) rather than a single plugin-keyed slot.
public struct AIProviderConfigSync: Codable, Sendable, Equatable {
    /// Whether AI summaries are enabled.
    public var enabled: Bool
    /// The configuration used for summaries; nil / absent == zero-config path.
    public var selectedConfigId: UUID?
    /// Every configured provider, fully resolved (values + secrets).
    public var configs: [ResolvedProviderConfig]

    public init(enabled: Bool, selectedConfigId: UUID?, configs: [ResolvedProviderConfig]) {
        self.enabled = enabled
        self.selectedConfigId = selectedConfigId
        self.configs = configs
    }
}

/// One fully-resolved configuration on the wire: identity plus the resolved value
/// bag split into non-secret `values` and `secrets` (an empty secret value means
/// "clear this credential"). The daemon persists each under `AIProviderConfigKeys`
/// keyed by `id`.
public struct ResolvedProviderConfig: Codable, Sendable, Equatable {
    public var id: UUID
    public var name: String
    public var pluginIdentifier: String
    public var templateId: String
    public var model: String
    public var values: [String: String]
    public var secrets: [String: String]

    public init(
        id: UUID, name: String, pluginIdentifier: String, templateId: String,
        model: String, values: [String: String], secrets: [String: String]
    ) {
        self.id = id
        self.name = name
        self.pluginIdentifier = pluginIdentifier
        self.templateId = templateId
        self.model = model
        self.values = values
        self.secrets = secrets
    }
}

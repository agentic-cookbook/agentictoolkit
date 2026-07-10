import Foundation

/// Read-only access to the host's settings store for provider-registry keys. Hosts pass a
/// closure over whatever holds the synced values (stenographer: its SQLite settings table)
/// — the resolver and `DaemonAIChat` never see the store itself. Returns nil when a key is
/// absent.
public typealias ProviderSettingsReader = @Sendable (_ key: String) -> String?

/// The daemon-side registry read API — the mirror of the app's `AIProviderResolver`.
/// Reads the config-UUID-keyed layout a headless host receives via `AIProviderConfigSync`
/// so it can resolve a configuration by id without the app. Returns nil / "" when the id
/// isn't known.
public enum DaemonProviderResolver {

    /// Every configuration identity the host currently mirrors (registry index).
    public static func configurations(_ settings: ProviderSettingsReader) -> [AIProviderConfiguration] {
        let json = settings(AIProviderConfigKeys.configurationsKey) ?? ""
        guard !json.isEmpty,
              let list = try? JSONDecoder().decode([AIProviderConfiguration].self, from: Data(json.utf8)) else {
            return []
        }
        return list
    }

    /// The configuration selected for one-shot completions, if one is selected and known.
    public static func selectedConfiguration(_ settings: ProviderSettingsReader) -> AIProviderConfiguration? {
        let id = settings(AIProviderConfigKeys.selectedConfigIdKey) ?? ""
        guard !id.isEmpty, let uuid = UUID(uuidString: id) else { return nil }
        return configurations(settings).first { $0.id == uuid }
    }

    /// A configuration's stored model ("" when unset).
    public static func model(config id: UUID, _ settings: ProviderSettingsReader) -> String {
        settings(AIProviderConfigKeys.modelKey(config: id)) ?? ""
    }
}

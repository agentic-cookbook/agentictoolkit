import Foundation

/// The single source of truth for the per-configuration storage-key namespace,
/// shared by the app's `AIProviderConfigStore` (UserDefaults / app-Keychain) and the
/// daemon's registry (settings table / daemon-Keychain). Both key a configuration's
/// field values, model, and ledgers by the configuration's UUID, so a configuration
/// id maps to the same key strings on both sides and the two layouts cannot drift.
public enum AIProviderConfigKeys {

    /// Storage key for one of a configuration's descriptor fields (secret or plain).
    public static func fieldKey(config id: UUID, field key: String) -> String {
        "aiplugin.config.\(id.uuidString).field.\(key)"
    }

    /// Storage key for a configuration's selected model.
    public static func modelKey(config id: UUID) -> String {
        "aiplugin.config.\(id.uuidString).model"
    }

    /// Newline-joined descriptor field keys whose *secrets* are currently stored for
    /// `id` — a ledger the Keychain can't enumerate, used to clear exactly those
    /// entries when the configuration is removed. (Daemon-side.)
    public static func secretFieldsKey(config id: UUID) -> String {
        "aiplugin.config.\(id.uuidString).secretfields"
    }

    /// Newline-joined *non-secret* value keys stored for `id`, so removal can clear
    /// them too. (Daemon-side.)
    public static func fieldsKey(config id: UUID) -> String {
        "aiplugin.config.\(id.uuidString).fields"
    }

    /// Settings key holding the id of the configuration used for AI summaries.
    /// Empty means the daemon's zero-config Claude-CLI path.
    public static let selectedConfigIdKey = "ai_selected_config_id"

    /// Settings key for the daemon's registry index: JSON `[AIProviderConfiguration]`.
    public static let configurationsKey = "ai_configurations"

    /// Settings key for the summaries-enabled flag.
    public static let enabledKey = "ai_summaries_enabled"

    /// One-time guard: legacy plugin-keyed AI settings have been cleaned up.
    public static let legacyCleanedKey = "ai_legacy_cleaned"
}

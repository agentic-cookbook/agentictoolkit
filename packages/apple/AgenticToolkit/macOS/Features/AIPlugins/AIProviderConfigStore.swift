import Foundation
import AIPluginKit
import AgenticToolkitCore

/// Maps an `AIProviderConfiguration` onto persisted settings, keyed by the
/// configuration's UUID. Mirrors the retired `PluginConfigStore` key convention
/// (`aiplugin.<x>.field.<key>` / `aiplugin.<x>.model`) but with `<x>` = the
/// configuration id instead of the plugin id, so several configurations of one
/// plugin coexist. Secrets route to the Keychain via `isSecure`.
@MainActor
public enum AIProviderConfigStore {

    public static func fieldKey(config id: UUID, field key: String) -> String {
        AIProviderConfigKeys.fieldKey(config: id, field: key)
    }

    public static func modelKey(config id: UUID) -> String {
        AIProviderConfigKeys.modelKey(config: id)
    }

    public static func fieldSetting(config id: UUID, field: AIPluginDescriptor.Field) -> UserSetting<String> {
        UserSetting(fieldKey(config: id, field: field.key), default: "", isSecure: field.isSecret)
    }

    public static func modelSetting(
        config id: UUID,
        template: AIPluginDescriptor.ProviderTemplate
    ) -> UserSetting<String> {
        UserSetting(modelKey(config: id), default: template.resolvedDefaultModel)
    }

    public static func selectedModel(
        config: AIProviderConfiguration,
        template: AIPluginDescriptor.ProviderTemplate
    ) -> String {
        let value = modelSetting(config: config.id, template: template).currentValue
        return value.isEmpty ? template.resolvedDefaultModel : value
    }

    /// The `AIPluginConfig` bag for one configuration: the template's default
    /// values (baseURL, authMode, …) overlaid with any edited field values, plus
    /// the resolved `model`.
    ///
    /// Empty non-secret edits don't clobber a template default. Secret fields, by
    /// contrast, are included **even when empty** — secrets never have a default to
    /// clobber, and their presence-with-empty-value lets a plugin distinguish "this
    /// template requires a key and it's blank" (fail fast) from "this is a keyless
    /// template with no secret field at all".
    public static func configValues(
        for config: AIProviderConfiguration,
        template: AIPluginDescriptor.ProviderTemplate,
        fields: [AIPluginDescriptor.Field]
    ) -> [String: String] {
        var values = template.defaultValues
        for field in fields {
            let stored = fieldSetting(config: config.id, field: field).currentValue
            if field.isSecret || !stored.isEmpty { values[field.key] = stored }
        }
        values["model"] = selectedModel(config: config, template: template)
        return values
    }

    /// Prefill a freshly-created configuration from its template: non-secret
    /// defaults (e.g. baseURL) and the default model; secrets stay empty.
    public static func seed(
        config: AIProviderConfiguration,
        template: AIPluginDescriptor.ProviderTemplate,
        fields: [AIPluginDescriptor.Field]
    ) {
        for field in fields {
            if let defaultValue = template.defaultValues[field.key] {
                fieldSetting(config: config.id, field: field).value = defaultValue
            }
        }
        modelSetting(config: config.id, template: template).value = template.resolvedDefaultModel
    }

    /// Clear a removed configuration's stored field values, secrets, and model by
    /// resetting them to empty (secrets set to "" are effectively deleted).
    ///
    /// Takes no template: the model key is configuration-scoped, so removal works
    /// even when the configuration's template no longer resolves (plugin uninstalled
    /// or template renamed) — the caller passes whatever field list it can still
    /// find so the Keychain secret is cleared regardless.
    public static func clearStoredValues(
        config: AIProviderConfiguration,
        fields: [AIPluginDescriptor.Field]
    ) {
        for field in fields {
            fieldSetting(config: config.id, field: field).value = ""
        }
        UserSetting<String>(modelKey(config: config.id), default: "").value = ""
    }
}

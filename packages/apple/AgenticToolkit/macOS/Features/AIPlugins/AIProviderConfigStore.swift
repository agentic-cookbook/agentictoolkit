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
        "aiplugin.config.\(id.uuidString).field.\(key)"
    }

    public static func modelKey(config id: UUID) -> String {
        "aiplugin.config.\(id.uuidString).model"
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
    /// values (baseURL, authMode, …) overlaid with any edited field values (empty
    /// edits don't clobber a default), plus the resolved `model`.
    public static func configValues(
        for config: AIProviderConfiguration,
        template: AIPluginDescriptor.ProviderTemplate,
        fields: [AIPluginDescriptor.Field]
    ) -> [String: String] {
        var values = template.defaultValues
        for field in fields {
            let stored = fieldSetting(config: config.id, field: field).currentValue
            if !stored.isEmpty { values[field.key] = stored }
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
    public static func clearStoredValues(
        config: AIProviderConfiguration,
        fields: [AIPluginDescriptor.Field],
        template: AIPluginDescriptor.ProviderTemplate
    ) {
        for field in fields {
            fieldSetting(config: config.id, field: field).value = ""
        }
        modelSetting(config: config.id, template: template).value = ""
    }
}

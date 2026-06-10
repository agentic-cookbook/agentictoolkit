import Foundation
import AIPluginKit
import AgenticToolkitCore

/// The single authoritative place that maps a plugin's descriptor onto persisted
/// settings. It owns the key convention, routes secret fields to the Keychain
/// (via `UserSetting(isSecure:)`) and plain fields to user defaults, and resolves
/// a descriptor's current values into the `[String: String]` an `AIPluginConfig`
/// expects.
///
/// Every accessor returns a fresh `UserSetting` bound to the same underlying
/// store by name, so callers (the settings UI and the chat backend) observe and
/// mutate the same value without sharing an instance.
@MainActor
public enum PluginConfigStore {

    /// Setting key for one of a plugin's descriptor fields.
    public static func fieldKey(plugin identifier: String, field key: String) -> String {
        "aiplugin.\(identifier).field.\(key)"
    }

    /// Setting key for a plugin's selected model.
    public static func modelKey(plugin identifier: String) -> String {
        "aiplugin.\(identifier).model"
    }

    /// Setting key for the globally selected plugin identifier.
    public static let selectedPluginKey = "aiplugin.selectedPlugin"

    // MARK: - Settings

    public static func selectedPluginSetting() -> UserSetting<String> {
        UserSetting(selectedPluginKey, default: "")
    }

    public static func fieldSetting(
        plugin identifier: String,
        field: AIPluginDescriptor.Field
    ) -> UserSetting<String> {
        UserSetting(fieldKey(plugin: identifier, field: field.key), default: "", isSecure: field.isSecret)
    }

    public static func modelSetting(for descriptor: AIPluginDescriptor) -> UserSetting<String> {
        UserSetting(modelKey(plugin: descriptor.identifier), default: descriptor.resolvedDefaultModel)
    }

    // MARK: - Resolution

    /// The chosen model for a plugin, or its descriptor default if unset.
    public static func selectedModel(for descriptor: AIPluginDescriptor) -> String {
        let value = modelSetting(for: descriptor).currentValue
        return value.isEmpty ? descriptor.resolvedDefaultModel : value
    }

    /// All current field values for a plugin keyed by field key, plus a `model`
    /// entry — exactly the shape `AIPluginConfig` reads. Secrets are pulled from
    /// the Keychain transparently.
    public static func configValues(for descriptor: AIPluginDescriptor) -> [String: String] {
        var values: [String: String] = [:]
        for field in descriptor.fields {
            values[field.key] = fieldSetting(plugin: descriptor.identifier, field: field).currentValue
        }
        values["model"] = selectedModel(for: descriptor)
        return values
    }
}

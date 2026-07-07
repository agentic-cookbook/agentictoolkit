import Foundation
import AIPluginKit
import AgenticToolkitCore

/// One-time migration of the retired per-plugin AI settings (`aiplugin.<id>.*`
/// + `aiplugin.selectedPlugin`) into named configurations.
///
/// `plan` is a pure function — deterministically testable with synthetic
/// descriptors and no on-disk plugins or live settings store — while the IO
/// half (`runIfNeeded`) is the only member isolated to `@MainActor`, since
/// it's the only part that touches `UserSetting`/`PluginConfigStore`/
/// `AIProviderConfigStore` (all themselves `@MainActor`-isolated).
public enum AIProviderMigration {

    private static let legacyTemplateId: [String: String] = [
        "com.agentictoolkit.plugin.claude-api": "anthropic-api",
        "com.agentictoolkit.plugin.openai": "openai",
        "com.agentictoolkit.plugin.openai-compatible": "custom",
        "com.agentictoolkit.plugin.google": "gemini",
        "com.agentictoolkit.plugin.claude-local": "claude-local"
    ]

    public struct FieldWrite: Equatable {
        public let configId: UUID
        public let fieldKey: String
        public let isSecret: Bool
        public let value: String
    }

    public struct Plan {
        public var configurations: [AIProviderConfiguration] = []
        public var fieldWrites: [FieldWrite] = []
        public var modelWrites: [(configId: UUID, model: String)] = []
        public var selectedId: String = ""
    }

    /// Build the migration plan. `oldValues(descriptor)` returns that plugin's
    /// legacy field values (+ a `"model"` entry), i.e. `PluginConfigStore.configValues`.
    public static func plan(
        descriptors: [AIPluginDescriptor],
        legacySelected: String,
        oldValues: (AIPluginDescriptor) -> [String: String]
    ) -> Plan {
        var plan = Plan()
        for descriptor in descriptors {
            let values = oldValues(descriptor)

            let templateId = legacyTemplateId[descriptor.identifier]
            let templates = descriptor.resolvedTemplates
            guard let template = templates.first(where: { $0.id == templateId }) ?? templates.first
            else { continue }
            let fields = descriptor.fields(for: template)

            let hasSecret = fields.contains { $0.isSecret && !(values[$0.key] ?? "").isEmpty }
            let isSelected = !legacySelected.isEmpty && descriptor.identifier == legacySelected
            // Also carry forward a keyless-but-configured provider (e.g. a local
            // OpenAI-compatible endpoint with a custom baseURL and no API key): a
            // non-secret field set to a non-empty, non-default value means the user
            // configured it, so dropping it would silently lose their setup.
            let hasCustomField = fields.contains { field in
                guard !field.isSecret else { return false }
                let value = values[field.key] ?? ""
                return !value.isEmpty && value != (template.defaultValues[field.key] ?? "")
            }
            guard hasSecret || isSelected || hasCustomField else { continue }

            let name = AIProviderConfiguration.uniqueName(
                descriptor.displayName, avoiding: Set(plan.configurations.map(\.name))
            )
            let config = AIProviderConfiguration(
                name: name, pluginIdentifier: descriptor.identifier, templateId: template.id
            )
            for field in fields {
                let value = values[field.key] ?? template.defaultValues[field.key] ?? ""
                if !value.isEmpty {
                    plan.fieldWrites.append(FieldWrite(
                        configId: config.id, fieldKey: field.key, isSecret: field.isSecret, value: value))
                }
            }
            let model = values["model"].flatMap { $0.isEmpty ? nil : $0 } ?? template.resolvedDefaultModel
            plan.modelWrites.append((configId: config.id, model: model))
            plan.configurations.append(config)
            if isSelected { plan.selectedId = config.id.uuidString }
        }
        return plan
    }

    /// Apply the plan to the store + settings once. No-op after the first run.
    @MainActor
    public static func runIfNeeded(pluginManager: AIPluginManager) {
        guard !UserSettings.aiProvidersMigrated.value else { return }

        let legacySelected = PluginConfigStore.selectedPluginSetting().currentValue
        let plan = plan(
            descriptors: pluginManager.descriptors,
            legacySelected: legacySelected,
            oldValues: { PluginConfigStore.configValues(for: $0) }
        )

        for write in plan.fieldWrites {
            UserSetting<String>(
                AIProviderConfigStore.fieldKey(config: write.configId, field: write.fieldKey),
                default: "", isSecure: write.isSecret
            ).value = write.value
        }
        for write in plan.modelWrites {
            UserSetting<String>(
                AIProviderConfigStore.modelKey(config: write.configId), default: ""
            ).value = write.model
        }
        UserSettings.aiProviderConfigurations.value = plan.configurations
        if !plan.selectedId.isEmpty {
            UserSettings.selectedAIProviderConfigurationId.value = plan.selectedId
        }
        UserSettings.aiProvidersMigrated.value = true
    }

}

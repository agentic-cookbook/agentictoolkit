import Foundation
import AIPluginKit
import AgenticToolkitCore

/// Turns a configuration into the plugin identifier, model, and resolved value
/// bag the chat backend and daemon-push consume — the one place that joins a
/// configuration to its template and stored values.
@MainActor
public enum AIProviderResolver {

    public struct Resolved: Sendable {
        public let pluginIdentifier: String
        public let model: String
        public let values: [String: String]
        public let fields: [AIPluginDescriptor.Field]
    }

    public static func resolve(_ config: AIProviderConfiguration, manager: AIPluginManager) -> Resolved? {
        guard let descriptor = manager.descriptor(for: config.pluginIdentifier) else { return nil }
        // Match the configuration's template strictly. Falling back to the first
        // template when the id no longer resolves (e.g. a plugin update renamed or
        // removed it) would silently bind the user's saved credentials/model to an
        // UNRELATED provider — wrong baseURL/authMode/model — and push that to the
        // daemon as if unchanged. Fail closed instead (mirroring
        // `AIPluginManager.template(pluginIdentifier:templateId:)`).
        guard let template = descriptor.resolvedTemplates.first(where: { $0.id == config.templateId }) else {
            return nil
        }
        let fields = descriptor.fields(for: template)
        return Resolved(
            pluginIdentifier: config.pluginIdentifier,
            model: AIProviderConfigStore.selectedModel(config: config, template: template),
            values: AIProviderConfigStore.configValues(for: config, template: template, fields: fields),
            fields: fields
        )
    }
}

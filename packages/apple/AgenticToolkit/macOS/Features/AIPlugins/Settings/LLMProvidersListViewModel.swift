import Foundation
import Combine
import AIPluginKit
import AgenticToolkitCore

/// Backs the LLM Providers settings list: the ordered configurations, the row the
/// editor is showing, and add/remove/rename against `UserSettings` + the
/// per-configuration `AIProviderConfigStore`.
@MainActor
final class LLMProvidersListViewModel: ObservableObject {

    @Published var configurations: [AIProviderConfiguration] = []
    /// The row selected for editing (independent of the summaries-active id).
    @Published var selectedId: UUID?

    let pluginManager: AIPluginManager

    init(pluginManager: AIPluginManager) {
        self.pluginManager = pluginManager
        self.configurations = UserSettings.aiProviderConfigurations.value
    }

    /// Every provider template every installed plugin advertises — the `+` menu.
    var availableTemplates: [AIPluginManager.AvailableProviderTemplate] {
        pluginManager.availableTemplates
    }

    func add(_ available: AIPluginManager.AvailableProviderTemplate) {
        let template = available.template
        let config = AIProviderConfiguration(
            name: uniqueName(template.displayName),
            pluginIdentifier: available.pluginIdentifier,
            templateId: template.id
        )
        let fields = resolvedFields(pluginIdentifier: available.pluginIdentifier, template: template)
        AIProviderConfigStore.seed(config: config, template: template, fields: fields)
        configurations.append(config)
        persist()
        selectedId = config.id
    }

    func remove(_ id: UUID) {
        guard let index = configurations.firstIndex(where: { $0.id == id }) else { return }
        let config = configurations[index]
        if let template = pluginManager.template(
            pluginIdentifier: config.pluginIdentifier, templateId: config.templateId
        ) {
            let fields = resolvedFields(pluginIdentifier: config.pluginIdentifier, template: template)
            AIProviderConfigStore.clearStoredValues(config: config, fields: fields, template: template)
        }
        configurations.remove(at: index)
        persist()
        if selectedId == id { selectedId = configurations.first?.id }
        if UserSettings.selectedAIProviderConfigurationId.value == id.uuidString {
            UserSettings.selectedAIProviderConfigurationId.value = ""
        }
    }

    func rename(_ id: UUID, to newName: String) {
        guard let index = configurations.firstIndex(where: { $0.id == id }) else { return }
        let trimmed = newName.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty, trimmed != configurations[index].name else { return }
        configurations[index].name = uniqueName(trimmed, excluding: id)
        persist()
    }

    /// A name not already used by another configuration, appending " 2", " 3", ….
    func uniqueName(_ base: String, excluding id: UUID? = nil) -> String {
        let taken = Set(configurations.filter { $0.id != id }.map(\.name))
        if !taken.contains(base) { return base }
        var suffix = 2
        while taken.contains("\(base) \(suffix)") { suffix += 1 }
        return "\(base) \(suffix)"
    }

    func configuration(for id: UUID) -> AIProviderConfiguration? {
        configurations.first { $0.id == id }
    }

    private func resolvedFields(
        pluginIdentifier: String,
        template: AIPluginDescriptor.ProviderTemplate
    ) -> [AIPluginDescriptor.Field] {
        pluginManager.descriptor(for: pluginIdentifier)?.fields(for: template) ?? (template.fields ?? [])
    }

    private func persist() {
        UserSettings.aiProviderConfigurations.value = configurations
    }
}

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

    /// Invoked when the `+` control is tapped. The hosting AppKit controller sets
    /// this to present the modal provider picker over its window (SwiftUI can't
    /// present the AppKit sheet itself).
    var onRequestAddProvider: (() -> Void)?

    init(pluginManager: AIPluginManager) {
        self.pluginManager = pluginManager
        self.configurations = UserSettings.aiProviderConfigurations.value
    }

    /// The picker's rows: every available template as a (provider, LLM, config
    /// type) row, always sorted by provider name (then LLM, then config type for
    /// a stable, readable order — e.g. Anthropic's rows group together).
    var pickerRows: [ProviderPickerRow] {
        availableTemplates
            .map { ProviderPickerRow(available: $0) }
            .sorted { lhs, rhs in
                let byProvider = lhs.provider.localizedCaseInsensitiveCompare(rhs.provider)
                if byProvider != .orderedSame { return byProvider == .orderedAscending }
                let byLLM = lhs.llm.localizedCaseInsensitiveCompare(rhs.llm)
                if byLLM != .orderedSame { return byLLM == .orderedAscending }
                return lhs.configType.localizedCaseInsensitiveCompare(rhs.configType) == .orderedAscending
            }
    }

    /// Every provider template every installed plugin advertises.
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
        // Clear the config's stored fields/secrets/model even when its template no
        // longer resolves (plugin uninstalled or template renamed): fall back to the
        // descriptor's shared field list so the Keychain API key is still removed,
        // honoring the delete confirmation's "including any API key" promise.
        let fields: [AIPluginDescriptor.Field]
        if let template = pluginManager.template(
            pluginIdentifier: config.pluginIdentifier, templateId: config.templateId
        ) {
            fields = resolvedFields(pluginIdentifier: config.pluginIdentifier, template: template)
        } else {
            fields = pluginManager.descriptor(for: config.pluginIdentifier)?.fields ?? []
        }
        AIProviderConfigStore.clearStoredValues(config: config, fields: fields)
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

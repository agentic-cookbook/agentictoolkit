import Foundation
import Testing
@testable import AIPluginKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("LLMProvidersListViewModel")
@MainActor
struct LLMProvidersListViewModelTests {

    private func manager() -> AIPluginManager {
        let pluginManager = AIPluginManager(searchPaths: [], appName: "Test")
        pluginManager.registerForTesting(AIPluginDescriptor(
            schemaVersion: 3, identifier: "com.x.openai-compatible", displayName: "OpenAI-compatible",
            version: "1.0",
            fields: [.init(key: "baseURL", label: "Base URL", kind: .text),
                     .init(key: "apiKey", label: "API Key", kind: .secret)],
            templates: [.init(id: "groq", displayName: "Groq",
                              defaultValues: ["baseURL": "https://api.groq.com/openai/v1"],
                              models: ["m1"], defaultModel: "m1")]
        ))
        return pluginManager
    }

    private func reset() {
        UserSettings.aiProviderConfigurations.value = []
        UserSettings.selectedAIProviderConfigurationId.value = ""
    }

    @Test("Adding a template appends a seeded, uniquely-named configuration")
    func addSeeds() throws {
        reset()
        let viewModel = LLMProvidersListViewModel(pluginManager: manager())
        let groq = try #require(viewModel.availableTemplates.first)
        viewModel.add(groq)
        viewModel.add(groq)
        defer {
            for config in viewModel.configurations {
                viewModel.remove(config.id)
            }
        }
        #expect(viewModel.configurations.count == 2)
        #expect(viewModel.configurations.map(\.name) == ["Groq", "Groq 2"])
        // Seeded baseURL is present for the first configuration.
        let first = viewModel.configurations[0]
        let baseURL = AIProviderConfigStore.fieldSetting(
            config: first.id, field: .init(key: "baseURL", label: "Base URL", kind: .text)
        ).currentValue
        #expect(baseURL == "https://api.groq.com/openai/v1")
    }

    @Test("availableTemplateGroups groups templates by plugin, preserving discovery order")
    func templateGroups() {
        reset()
        let pluginManager = AIPluginManager(searchPaths: [], appName: "Test")
        pluginManager.registerForTesting(AIPluginDescriptor(
            schemaVersion: 3, identifier: "com.x.openai-compatible", displayName: "OpenAI-compatible",
            version: "1.0",
            fields: [.init(key: "apiKey", label: "API Key", kind: .secret)],
            templates: [.init(id: "groq", displayName: "Groq", models: ["m1"], defaultModel: "m1"),
                        .init(id: "mistral", displayName: "Mistral", models: ["m1"], defaultModel: "m1")]
        ))
        pluginManager.registerForTesting(AIPluginDescriptor(
            schemaVersion: 3, identifier: "com.x.claude", displayName: "Claude",
            version: "1.0",
            fields: [.init(key: "apiKey", label: "API Key", kind: .secret)],
            templates: [.init(id: "anthropic-api", displayName: "Anthropic API",
                              models: ["m1"], defaultModel: "m1")]
        ))
        let viewModel = LLMProvidersListViewModel(pluginManager: pluginManager)

        let groups = viewModel.availableTemplateGroups
        #expect(groups.map(\.pluginIdentifier) == ["com.x.openai-compatible", "com.x.claude"])
        #expect(groups.map(\.pluginName) == ["OpenAI-compatible", "Claude"])
        #expect(groups[0].templates.map(\.template.displayName) == ["Groq", "Mistral"])
        #expect(groups[1].templates.map(\.template.displayName) == ["Anthropic API"])
    }

    @Test("Removing a configuration drops it and clears the active selection if it pointed there")
    func removeClearsSelection() {
        reset()
        let viewModel = LLMProvidersListViewModel(pluginManager: manager())
        viewModel.add(viewModel.availableTemplates[0])
        let id = viewModel.configurations[0].id
        UserSettings.selectedAIProviderConfigurationId.value = id.uuidString
        viewModel.remove(id)
        #expect(viewModel.configurations.isEmpty)
        #expect(UserSettings.selectedAIProviderConfigurationId.value == "")
    }
}

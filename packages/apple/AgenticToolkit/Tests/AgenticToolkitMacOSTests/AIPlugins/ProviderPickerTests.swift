import Foundation
import Testing
@testable import AIPluginKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("ProviderPicker")
@MainActor
struct ProviderPickerTests {

    private func row(_ name: String, type: String) -> ProviderPickerRow {
        ProviderPickerRow(
            available: .init(
                pluginIdentifier: "com.x.\(type)",
                template: .init(id: name.lowercased(), displayName: name)),
            configType: type)
    }

    @Test("Filter matches on provider name (case-insensitive)")
    func filterByName() {
        let rows = [row("Groq", type: "OpenAI-compatible"), row("Gemini", type: "Google")]
        #expect(ProviderPickerFilter.filter(rows, query: "gro").map(\.providerName) == ["Groq"])
        #expect(ProviderPickerFilter.filter(rows, query: "GEM").map(\.providerName) == ["Gemini"])
    }

    @Test("Filter matches on configuration type too")
    func filterByType() {
        let rows = [row("Groq", type: "OpenAI-compatible"), row("Gemini", type: "Google")]
        #expect(ProviderPickerFilter.filter(rows, query: "google").map(\.providerName) == ["Gemini"])
    }

    @Test("Empty / whitespace query returns everything")
    func emptyQuery() {
        let rows = [row("Groq", type: "OpenAI-compatible"), row("Gemini", type: "Google")]
        #expect(ProviderPickerFilter.filter(rows, query: "").count == 2)
        #expect(ProviderPickerFilter.filter(rows, query: "   ").count == 2)
    }

    @Test("pickerRows flattens groups and tags each row with its plugin name")
    func pickerRows() {
        UserSettings.aiProviderConfigurations.value = []
        let manager = AIPluginManager(searchPaths: [], appName: "Test")
        manager.registerForTesting(AIPluginDescriptor(
            schemaVersion: 3, identifier: "com.x.oc", displayName: "OpenAI-compatible", version: "1.0",
            fields: [], templates: [
                .init(id: "groq", displayName: "Groq", models: ["m"], defaultModel: "m"),
                .init(id: "mistral", displayName: "Mistral", models: ["m"], defaultModel: "m")]))
        manager.registerForTesting(AIPluginDescriptor(
            schemaVersion: 3, identifier: "com.x.g", displayName: "Google", version: "1.0",
            fields: [], templates: [.init(id: "gemini", displayName: "Gemini", models: ["m"], defaultModel: "m")]))
        let viewModel = LLMProvidersListViewModel(pluginManager: manager)

        let rows = viewModel.pickerRows
        #expect(rows.map(\.providerName) == ["Groq", "Mistral", "Gemini"])
        #expect(rows.map(\.configType) == ["OpenAI-compatible", "OpenAI-compatible", "Google"])
    }
}

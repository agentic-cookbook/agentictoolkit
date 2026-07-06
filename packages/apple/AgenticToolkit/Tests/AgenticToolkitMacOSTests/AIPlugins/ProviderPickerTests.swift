import Foundation
import Testing
@testable import AIPluginKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("ProviderPicker")
@MainActor
struct ProviderPickerTests {

    private func row(provider: String, llm: String, configType: String) -> ProviderPickerRow {
        ProviderPickerRow(available: .init(
            pluginIdentifier: "com.x",
            template: .init(id: "\(provider)-\(configType)".lowercased(), displayName: "\(provider) \(llm)",
                            provider: provider, llm: llm, configType: configType)))
    }

    @Test("ProviderTemplate resolves provider/llm/configType, with fallbacks")
    func resolvedAccessors() {
        let explicit = AIPluginDescriptor.ProviderTemplate(
            id: "t", displayName: "T", secretRequired: true,
            provider: "Anthropic", llm: "Claude", configType: "OAuth Account")
        #expect(explicit.resolvedProvider == "Anthropic")
        #expect(explicit.resolvedLLM == "Claude")
        #expect(explicit.resolvedConfigType == "OAuth Account")

        let bareSecret = AIPluginDescriptor.ProviderTemplate(id: "t", displayName: "Fallback", secretRequired: true)
        #expect(bareSecret.resolvedProvider == "Fallback")   // falls back to displayName
        #expect(bareSecret.resolvedLLM == "")
        #expect(bareSecret.resolvedConfigType == "API Key")  // inferred from secretRequired

        let bareLocal = AIPluginDescriptor.ProviderTemplate(id: "t", displayName: "L", secretRequired: false)
        #expect(bareLocal.resolvedConfigType == "Local")
    }

    @Test("Filter matches provider, llm, or config type (case-insensitive)")
    func filterAcrossColumns() {
        let rows = [
            row(provider: "Anthropic", llm: "Claude", configType: "API Key"),
            row(provider: "Google", llm: "Gemini", configType: "API Key"),
            row(provider: "Anthropic", llm: "Claude", configType: "OAuth Account")
        ]
        #expect(ProviderPickerFilter.filter(rows, query: "anthropic").count == 2)
        #expect(ProviderPickerFilter.filter(rows, query: "GEMINI").map(\.provider) == ["Google"])
        #expect(ProviderPickerFilter.filter(rows, query: "oauth").map(\.provider) == ["Anthropic"])
        #expect(ProviderPickerFilter.filter(rows, query: "   ").count == 3)
    }

    @Test("pickerRows always sorts by provider, then llm, then config type")
    func pickerRowsSorted() {
        UserSettings.aiProviderConfigurations.value = []
        let manager = AIPluginManager(searchPaths: [], appName: "Test")
        // Register out of alphabetical order to prove the sort.
        manager.registerForTesting(AIPluginDescriptor(
            schemaVersion: 3, identifier: "com.x.g", displayName: "Google", version: "1.0",
            fields: [], templates: [.init(id: "gemini", displayName: "Gemini",
                                          provider: "Google", llm: "Gemini", configType: "API Key")]))
        manager.registerForTesting(AIPluginDescriptor(
            schemaVersion: 3, identifier: "com.x.claude", displayName: "Claude", version: "1.0",
            fields: [], templates: [
                .init(id: "sub", displayName: "Claude Max", provider: "Anthropic", llm: "Claude",
                      configType: "Subscription Token"),
                .init(id: "api", displayName: "Anthropic API", provider: "Anthropic", llm: "Claude",
                      configType: "API Key")]))
        let viewModel = LLMProvidersListViewModel(pluginManager: manager)

        let rows = viewModel.pickerRows
        #expect(rows.map(\.provider) == ["Anthropic", "Anthropic", "Google"])
        // Within Anthropic, config type sorts "API Key" before "Subscription Token".
        #expect(rows.map(\.configType) == ["API Key", "Subscription Token", "API Key"])
    }
}

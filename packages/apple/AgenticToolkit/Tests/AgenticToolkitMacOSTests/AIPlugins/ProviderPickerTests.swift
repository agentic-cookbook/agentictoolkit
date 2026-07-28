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

    @Test("ProviderTemplate decodes provider/llm descriptions and per-model details")
    func decodesDetails() throws {
        let json = """
        {"id":"t","displayName":"T","defaultValues":{},"models":["m1"],"secretRequired":true,
         "provider":"Anthropic","llm":"Claude","configType":"API Key",
         "providerDescription":"P","llmDescription":"L",
         "modelDetails":[{"id":"m1","description":"d","tools":true,"goodFor":"g"}]}
        """
        let template = try JSONDecoder().decode(AIPluginDescriptor.ProviderTemplate.self, from: Data(json.utf8))
        #expect(template.providerDescription == "P")
        #expect(template.llmDescription == "L")
        let detail = try #require(template.modelDetail(for: "m1"))
        #expect(detail.description == "d")
        #expect(detail.tools == true)
        #expect(detail.goodFor == "g")
        #expect(template.modelDetail(for: "missing") == nil)
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

    @Test("Filter narrows by provider type, independently of the query")
    func filterByType() {
        let rows = [
            row(provider: "Anthropic", llm: "Claude", configType: "API Key"),
            row(provider: "Anthropic", llm: "Claude", configType: "OAuth Account"),
            row(provider: "Ollama", llm: "Local", configType: "Local")
        ]
        #expect(ProviderPickerFilter.filter(rows, query: "", types: [.local]).map(\.provider) == ["Ollama"])
        #expect(ProviderPickerFilter.filter(rows, query: "", types: [.apiKey, .subscription]).count == 2)
        #expect(ProviderPickerFilter.filter(rows, query: "", types: []).count == 3)
        // Query and type are ANDed.
        #expect(ProviderPickerFilter.filter(rows, query: "anthropic", types: [.local]).isEmpty)
    }

    @Test("Filter narrows by what the provider's models are good for")
    func filterByUse() {
        let coder = ProviderPickerRow(available: .init(
            pluginIdentifier: "com.x",
            template: .init(id: "t1", displayName: "Coder", models: ["m-code"], provider: "Coder",
                            llm: "C", configType: "API Key",
                            modelDetails: [.init(id: "m-code", description: "Great at coding")])))
        let writer = ProviderPickerRow(available: .init(
            pluginIdentifier: "com.x",
            template: .init(id: "t2", displayName: "Writer", models: ["m-write"], provider: "Writer",
                            llm: "W", configType: "API Key",
                            modelDetails: [.init(id: "m-write", description: "Creative writing")])))
        // No models listed at all — a local server whose list is only known at runtime.
        let unknown = row(provider: "Ollama", llm: "Local", configType: "Local")

        #expect(coder.uses.contains(.coding))
        #expect(writer.uses.contains(.writing))
        #expect(unknown.uses.isEmpty)

        let rows = [coder, writer, unknown]
        // A provider with no known models is never hidden by a use filter.
        #expect(ProviderPickerFilter.filter(rows, query: "", uses: [.coding]).map(\.provider)
            == ["Coder", "Ollama"])
        #expect(ProviderPickerFilter.filter(rows, query: "", uses: [.coding, .writing]).count == 3)
    }

    @Test("A provider's uses are the union over all its models")
    func usesUnionAcrossModels() {
        let both = ProviderPickerRow(available: .init(
            pluginIdentifier: "com.x",
            template: .init(id: "t", displayName: "Both", models: ["a", "b"], provider: "Both",
                            llm: "B", configType: "API Key",
                            modelDetails: [.init(id: "a", description: "Great at coding"),
                                           .init(id: "b", description: "Creative writing")])))
        #expect(both.uses.isSuperset(of: [.coding, .writing]))
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

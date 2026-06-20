import Testing
@testable import AIPluginKit
@testable import AgenticToolkitMacOS

@Suite("SinglePluginChatConfigProvider")
@MainActor
struct SinglePluginChatConfigProviderTests {

    private func makeDescriptor() -> AIPluginDescriptor {
        AIPluginDescriptor(
            identifier: "com.example.single-provider-test",
            displayName: "Example",
            version: "1.0.0",
            models: ["model-a"]
        )
    }

    @Test("reports its own descriptor's identifier, not the global selection")
    func reportsOwnIdentifier() {
        let provider = SinglePluginChatConfigProvider(descriptor: makeDescriptor())
        #expect(provider.selectedPluginIdentifier == "com.example.single-provider-test")
    }

    @Test("falls back to the descriptor's default model when none is stored")
    func defaultModel() {
        let provider = SinglePluginChatConfigProvider(descriptor: makeDescriptor())
        #expect(provider.selectedModel == "model-a")
    }

    @Test("config values carry the resolved model")
    func configValuesCarryModel() {
        let provider = SinglePluginChatConfigProvider(descriptor: makeDescriptor())
        #expect(provider.pluginConfigValues["model"] == "model-a")
    }
}

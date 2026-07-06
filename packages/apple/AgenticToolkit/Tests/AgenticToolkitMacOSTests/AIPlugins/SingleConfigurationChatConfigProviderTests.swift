import Foundation
import Testing
@testable import AIPluginKit
@testable import AgenticToolkitMacOS

@Suite("SingleConfigurationChatConfigProvider")
@MainActor
struct SingleConfigChatConfigProviderTests {

    @Test("Reports the configuration's resolved plugin, model, and values live")
    func reportsResolved() {
        let template = AIPluginDescriptor.ProviderTemplate(
            id: "groq", displayName: "Groq",
            defaultValues: ["baseURL": "https://api.groq.com/openai/v1"],
            models: ["m1"], defaultModel: "m1",
            fields: [.init(key: "baseURL", label: "Base URL", kind: .text),
                     .init(key: "apiKey", label: "API Key", kind: .secret)]
        )
        let descriptor = AIPluginDescriptor(
            schemaVersion: 3, identifier: "com.x.oc", displayName: "OC", version: "1.0",
            fields: template.fields!, templates: [template]
        )
        let manager = AIPluginManager(searchPaths: [], appName: "Test")
        manager.registerForTesting(descriptor)
        let cfg = AIProviderConfiguration(name: "Groq", pluginIdentifier: "com.x.oc", templateId: "groq")
        AIProviderConfigStore.seed(config: cfg, template: template, fields: template.fields!)
        defer {
            AIProviderConfigStore.clearStoredValues(config: cfg, fields: template.fields!, template: template)
        }
        AIProviderConfigStore.fieldSetting(config: cfg.id, field: template.fields![1]).value = "sk"

        let provider = SingleConfigurationChatConfigProvider(configuration: cfg, pluginManager: manager)
        #expect(provider.selectedPluginIdentifier == "com.x.oc")
        #expect(provider.selectedModel == "m1")
        #expect(provider.pluginConfigValues["apiKey"] == "sk")
    }
}

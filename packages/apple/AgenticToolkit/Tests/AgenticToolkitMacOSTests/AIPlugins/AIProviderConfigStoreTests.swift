import Foundation
import Testing
@testable import AIPluginKit
@testable import AgenticToolkitMacOS

@Suite("AIProviderConfigStore")
@MainActor
struct AIProviderConfigStoreTests {

    private func template(secretRequired: Bool = true) -> AIPluginDescriptor.ProviderTemplate {
        .init(
            id: "groq", displayName: "Groq",
            defaultValues: ["baseURL": "https://api.groq.com/openai/v1"],
            models: ["m1", "m2"], defaultModel: "m1", secretRequired: secretRequired,
            fields: [
                .init(key: "baseURL", label: "Base URL", kind: .text),
                .init(key: "apiKey", label: "API Key", kind: .secret)
            ]
        )
    }

    @Test("Seed prefills baseURL + model from the template and leaves the secret empty")
    func seedPrefills() {
        let providerTemplate = template()
        let cfg = AIProviderConfiguration(name: "Groq", pluginIdentifier: "p", templateId: "groq")
        AIProviderConfigStore.seed(config: cfg, template: providerTemplate, fields: providerTemplate.fields!)
        defer {
            AIProviderConfigStore.clearStoredValues(config: cfg, fields: providerTemplate.fields!)
        }
        let values = AIProviderConfigStore.configValues(
            for: cfg, template: providerTemplate, fields: providerTemplate.fields!
        )
        #expect(values["baseURL"] == "https://api.groq.com/openai/v1")
        #expect(values["model"] == "m1")
        #expect((values["apiKey"] ?? "").isEmpty)
    }

    @Test("configValues overlays edited field values over the template defaults")
    func overlay() {
        let providerTemplate = template()
        let cfg = AIProviderConfiguration(name: "Groq", pluginIdentifier: "p", templateId: "groq")
        AIProviderConfigStore.seed(config: cfg, template: providerTemplate, fields: providerTemplate.fields!)
        defer {
            AIProviderConfigStore.clearStoredValues(config: cfg, fields: providerTemplate.fields!)
        }
        AIProviderConfigStore.fieldSetting(config: cfg.id, field: providerTemplate.fields![1]).value = "sk-test"
        let values = AIProviderConfigStore.configValues(
            for: cfg, template: providerTemplate, fields: providerTemplate.fields!
        )
        #expect(values["apiKey"] == "sk-test")
    }
}

@Suite("AIProviderResolver")
@MainActor
struct AIProviderResolverTests {

    @Test("Resolves an Anthropic-token configuration to bearer-oauth values")
    func resolvesAnthropicToken() throws {
        let template = AIPluginDescriptor.ProviderTemplate(
            id: "claude-max-token", displayName: "Claude Max (token)",
            defaultValues: ["baseURL": "https://api.anthropic.com/v1", "authMode": "bearer-oauth"],
            models: ["claude-sonnet-4-6"], defaultModel: "claude-sonnet-4-6",
            fields: [.init(key: "apiKey", label: "Session Token", kind: .secret)]
        )
        let descriptor = AIPluginDescriptor(
            identifier: "com.agentictoolkit.plugin.claude-api", displayName: "Claude (API)",
            version: "1.0", fields: [], templates: [template]
        )
        let manager = AIPluginManager(searchPaths: [], appName: "Test")
        manager.registerForTesting(descriptor)
        let cfg = AIProviderConfiguration(
            name: "Max", pluginIdentifier: descriptor.identifier, templateId: "claude-max-token"
        )
        AIProviderConfigStore.seed(config: cfg, template: template, fields: template.fields!)
        defer {
            AIProviderConfigStore.clearStoredValues(config: cfg, fields: template.fields!)
        }
        AIProviderConfigStore.fieldSetting(config: cfg.id, field: template.fields![0]).value = "tok-123"

        let resolved = try #require(AIProviderResolver.resolve(cfg, manager: manager))
        #expect(resolved.pluginIdentifier == descriptor.identifier)
        #expect(resolved.model == "claude-sonnet-4-6")
        #expect(resolved.values["authMode"] == "bearer-oauth")
        #expect(resolved.values["apiKey"] == "tok-123")
    }

    @Test("Fails closed (nil) when the configuration's template no longer resolves")
    func returnsNilForUnknownTemplate() {
        let template = AIPluginDescriptor.ProviderTemplate(
            id: "real-template", displayName: "Real",
            defaultValues: [:], models: ["m1"], defaultModel: "m1",
            fields: [.init(key: "apiKey", label: "API Key", kind: .secret)]
        )
        let descriptor = AIPluginDescriptor(
            identifier: "com.x.plugin", displayName: "X", version: "1.0", fields: [], templates: [template]
        )
        let manager = AIPluginManager(searchPaths: [], appName: "Test")
        manager.registerForTesting(descriptor)
        // Configuration references a template id the plugin no longer advertises.
        let cfg = AIProviderConfiguration(
            name: "Stale", pluginIdentifier: descriptor.identifier, templateId: "renamed-away"
        )
        // Must NOT silently fall back to the first template (wrong provider) — resolve nil.
        #expect(AIProviderResolver.resolve(cfg, manager: manager) == nil)
    }
}

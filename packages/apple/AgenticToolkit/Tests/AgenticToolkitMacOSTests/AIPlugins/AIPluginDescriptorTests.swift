import Testing
import Foundation
@testable import AIPluginKit
@testable import AgenticToolkitMacOS

@Suite("AIPluginDescriptor")
struct AIPluginDescriptorTests {

    @Test("decodes identity, models, and typed fields from JSON")
    func decodesFromJSON() throws {
        let json = Data("""
        {
          "schemaVersion": 2,
          "identifier": "com.example.provider",
          "displayName": "Example",
          "version": "1.2.3",
          "models": ["fast", "smart"],
          "defaultModel": "smart",
          "fields": [
            { "key": "apiKey", "label": "API Key", "kind": "secret" },
            { "key": "baseURL", "label": "Base URL", "kind": "text", "placeholder": "https://…" }
          ]
        }
        """.utf8)

        let descriptor = try JSONDecoder().decode(AIPluginDescriptor.self, from: json)

        #expect(descriptor.identifier == "com.example.provider")
        #expect(descriptor.models == ["fast", "smart"])
        #expect(descriptor.resolvedDefaultModel == "smart")
        #expect(descriptor.fields.count == 2)
        #expect(descriptor.fields[0].isSecret)
        #expect(descriptor.fields[1].kind == .text)
        #expect(descriptor.fields[1].placeholder == "https://…")
    }

    @Test("resolvedDefaultModel falls back to the first model when unspecified")
    func defaultModelFallback() {
        let withModels = AIPluginDescriptor(
            identifier: "a", displayName: "A", version: "1", models: ["one", "two"]
        )
        #expect(withModels.resolvedDefaultModel == "one")

        let empty = AIPluginDescriptor(identifier: "b", displayName: "B", version: "1")
        #expect(empty.resolvedDefaultModel == "")
    }
}

@Suite("AIPluginDescriptor templates")
struct AIPluginDescriptorTemplateTests {

    @Test("A v3 descriptor decodes explicit templates")
    func decodesTemplates() throws {
        let json = """
        {
          "schemaVersion": 3,
          "identifier": "com.example.p",
          "displayName": "P",
          "version": "1.0",
          "models": [],
          "defaultModel": null,
          "fields": [{ "key": "apiKey", "label": "API Key", "kind": "secret" }],
          "templates": [
            { "id": "a", "displayName": "A", "defaultValues": { "baseURL": "https://a/v1" },
              "models": ["m1", "m2"], "defaultModel": "m1", "secretRequired": true }
          ]
        }
        """
        let descriptor = try JSONDecoder().decode(AIPluginDescriptor.self, from: Data(json.utf8))
        #expect(descriptor.templates?.count == 1)
        let template = try #require(descriptor.resolvedTemplates.first)
        #expect(template.id == "a")
        #expect(template.defaultValues["baseURL"] == "https://a/v1")
        #expect(template.resolvedDefaultModel == "m1")
        // fields inherited from the descriptor when a template omits them:
        #expect(descriptor.fields(for: template).map(\.key) == ["apiKey"])
    }

    @Test("A descriptor with no templates yields one implicit template from itself")
    func implicitTemplate() {
        let descriptor = AIPluginDescriptor(
            identifier: "com.example.legacy", displayName: "Legacy", version: "1.0",
            models: ["only"], defaultModel: "only",
            fields: [.init(key: "apiKey", label: "API Key", kind: .secret)]
        )
        #expect(descriptor.templates == nil)
        let templates = descriptor.resolvedTemplates
        #expect(templates.count == 1)
        #expect(templates[0].displayName == "Legacy")
        #expect(templates[0].resolvedDefaultModel == "only")
        #expect(descriptor.fields(for: templates[0]).map(\.key) == ["apiKey"])
    }

    @Test("A template may override the descriptor's fields")
    func templateFieldOverride() throws {
        let template = AIPluginDescriptor.ProviderTemplate(
            id: "t", displayName: "T",
            fields: [.init(key: "apiKey", label: "Session Token", kind: .secret)]
        )
        let descriptor = AIPluginDescriptor(
            identifier: "com.example.o", displayName: "O", version: "1.0",
            fields: [.init(key: "apiKey", label: "API Key", kind: .secret)],
            templates: [template]
        )
        #expect(descriptor.fields(for: template).first?.label == "Session Token")
    }
}

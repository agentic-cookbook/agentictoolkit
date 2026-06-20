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

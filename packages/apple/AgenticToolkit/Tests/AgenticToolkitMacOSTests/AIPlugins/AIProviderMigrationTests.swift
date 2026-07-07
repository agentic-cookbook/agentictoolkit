import Foundation
import Testing
@testable import AIPluginKit
@testable import AgenticToolkitMacOS

@Suite("AIProviderMigration.plan")
struct AIProviderMigrationTests {

    private func descriptor(_ id: String, _ name: String, templateId: String) -> AIPluginDescriptor {
        AIPluginDescriptor(
            schemaVersion: 3, identifier: id, displayName: name, version: "1.0",
            fields: [.init(key: "apiKey", label: "API Key", kind: .secret)],
            templates: [.init(id: templateId, displayName: name,
                              defaultValues: ["baseURL": "https://api.example.com/v1"],
                              models: ["m1"], defaultModel: "m1",
                              fields: [.init(key: "apiKey", label: "API Key", kind: .secret)])]
        )
    }

    @Test("Configured plugins become configurations; the selected one is carried over")
    func migratesConfigured() {
        let openai = descriptor("com.agentictoolkit.plugin.openai", "OpenAI (ChatGPT)", templateId: "openai")
        let google = descriptor("com.agentictoolkit.plugin.google", "Google (Gemini)", templateId: "gemini")
        let values: [String: [String: String]] = [
            openai.identifier: ["apiKey": "sk-openai", "model": "m1"],
            google.identifier: ["apiKey": "", "model": "m1"]   // unconfigured (no secret)
        ]
        let plan = AIProviderMigration.plan(
            descriptors: [openai, google],
            legacySelected: openai.identifier,
            oldValues: { values[$0.identifier] ?? [:] }
        )
        #expect(plan.configurations.map(\.templateId) == ["openai"])   // google skipped
        #expect(plan.configurations[0].name == "OpenAI (ChatGPT)")
        #expect(plan.selectedId == plan.configurations[0].id.uuidString)
        #expect(plan.fieldWrites.contains { $0.fieldKey == "apiKey" && $0.value == "sk-openai" && $0.isSecret })
    }

    @Test("A keyless-but-configured, non-selected plugin is carried over (not dropped)")
    func migratesKeylessConfigured() {
        // OpenAI-compatible-style: a non-secret baseURL field, no API key, and NOT
        // the selected plugin — previously skipped and permanently lost.
        let openaiCompatible = AIPluginDescriptor(
            schemaVersion: 3, identifier: "com.agentictoolkit.plugin.openai-compatible",
            displayName: "OpenAI-compatible", version: "1.0",
            fields: [.init(key: "baseURL", label: "Base URL", kind: .text)],
            templates: [.init(id: "custom", displayName: "Custom",
                              defaultValues: ["baseURL": ""], models: [], defaultModel: nil,
                              fields: [.init(key: "baseURL", label: "Base URL", kind: .text)])]
        )
        let plan = AIProviderMigration.plan(
            descriptors: [openaiCompatible], legacySelected: "",
            oldValues: { _ in ["baseURL": "http://localhost:1234", "model": ""] }
        )
        #expect(plan.configurations.count == 1)
        #expect(plan.fieldWrites.contains { $0.fieldKey == "baseURL" && $0.value == "http://localhost:1234" })
    }

    @Test("An unconfigured, non-selected plugin produces nothing")
    func skipsEmpty() {
        let google = descriptor("com.agentictoolkit.plugin.google", "Google (Gemini)", templateId: "gemini")
        let plan = AIProviderMigration.plan(
            descriptors: [google], legacySelected: "", oldValues: { _ in ["apiKey": ""] }
        )
        #expect(plan.configurations.isEmpty)
        #expect(plan.selectedId == "")
    }
}

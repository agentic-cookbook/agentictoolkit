import Foundation
import Testing
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("AIProviderConfiguration")
@MainActor
struct AIProviderConfigurationTests {

    @Test("Round-trips through Codable")
    func codableRoundTrip() throws {
        let original = AIProviderConfiguration(
            id: UUID(), name: "My Groq", pluginIdentifier: "com.x.openai-compatible", templateId: "groq"
        )
        let data = try JSONEncoder().encode([original])
        let decoded = try JSONDecoder().decode([AIProviderConfiguration].self, from: data)
        #expect(decoded == [original])
    }

    @Test("The settings accessors round-trip a written list through the store")
    func settingsPersist() {
        let cfg = AIProviderConfiguration(name: "X", pluginIdentifier: "p", templateId: "t")
        UserSettings.aiProviderConfigurations.value = [cfg]
        UserSettings.selectedAIProviderConfigurationId.value = cfg.id.uuidString
        // Restore a clean state for other tests in this target, even if an expectation below fails.
        defer {
            UserSettings.aiProviderConfigurations.value = []
            UserSettings.selectedAIProviderConfigurationId.value = ""
        }
        #expect(UserSettings.aiProviderConfigurations.value == [cfg])
        #expect(UserSettings.selectedAIProviderConfigurationId.value == cfg.id.uuidString)
    }
}

import Foundation
import Testing
@testable import AIPluginKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("AIProviderDefaults")
@MainActor
struct AIProviderDefaultsTests {

    private func manager(includeLocal: Bool = true) -> AIPluginManager {
        let pluginManager = AIPluginManager(searchPaths: [], appName: "Test")
        if includeLocal {
            pluginManager.registerForTesting(AIPluginDescriptor(
                schemaVersion: 3, identifier: "com.x.claude-local", displayName: "Claude (Local)",
                version: "1.0",
                fields: [],
                templates: [.init(id: "claude-local", displayName: "Claude Code (local CLI)",
                                  models: ["sonnet"], defaultModel: "sonnet", secretRequired: false)]
            ))
        } else {
            pluginManager.registerForTesting(AIPluginDescriptor(
                schemaVersion: 3, identifier: "com.x.openai", displayName: "OpenAI",
                version: "1.0",
                fields: [.init(key: "apiKey", label: "API Key", kind: .secret)],
                templates: [.init(id: "openai", displayName: "OpenAI", models: ["m1"], defaultModel: "m1")]
            ))
        }
        return pluginManager
    }

    private func reset() {
        UserSettings.aiProviderConfigurations.value = []
        UserSettings.selectedAIProviderConfigurationId.value = ""
        UserSettings.aiDefaultConfigSeeded.value = false
    }

    @Test("Seeds a claude-local configuration into an empty list, without selecting it")
    func seedsWhenEmpty() {
        reset()
        defer { reset() }
        AIProviderDefaults.seedIfNeeded(pluginManager: manager())
        let configs = UserSettings.aiProviderConfigurations.value
        #expect(configs.count == 1)
        #expect(configs.first?.templateId == "claude-local")
        #expect(configs.first?.name == "Claude Code (local CLI)")
        // Left unselected so the daemon stays on its Default (Claude CLI) path.
        #expect(UserSettings.selectedAIProviderConfigurationId.value == "")
        #expect(UserSettings.aiDefaultConfigSeeded.value == true)
    }

    @Test("Is idempotent — a second run seeds nothing more")
    func idempotent() {
        reset()
        defer { reset() }
        AIProviderDefaults.seedIfNeeded(pluginManager: manager())
        AIProviderDefaults.seedIfNeeded(pluginManager: manager())
        #expect(UserSettings.aiProviderConfigurations.value.count == 1)
    }

    @Test("Never clobbers an existing non-empty list")
    func skipsWhenNotEmpty() {
        reset()
        defer { reset() }
        let existing = AIProviderConfiguration(
            name: "My Provider", pluginIdentifier: "com.x.openai", templateId: "openai")
        UserSettings.aiProviderConfigurations.value = [existing]
        AIProviderDefaults.seedIfNeeded(pluginManager: manager())
        #expect(UserSettings.aiProviderConfigurations.value == [existing])
        #expect(UserSettings.aiDefaultConfigSeeded.value == true)
    }

    @Test("Seeds nothing when no local Claude template is installed")
    func noLocalTemplate() {
        reset()
        defer { reset() }
        AIProviderDefaults.seedIfNeeded(pluginManager: manager(includeLocal: false))
        #expect(UserSettings.aiProviderConfigurations.value.isEmpty)
        // Still flips the guard so it doesn't retry every launch.
        #expect(UserSettings.aiDefaultConfigSeeded.value == true)
    }
}

import Testing
import Foundation
@testable import AgenticToolkitAIPluginsCore
@testable import AgenticToolkitAIPlugins
@testable import ClaudeAPIPlugin
@testable import ClaudeLocalPlugin
@testable import GooglePlugin
@testable import OpenAIPlugin
@testable import OpenAICompatiblePlugin

@Suite("Built-in Plugins")
@MainActor
struct BuiltInPluginTests {

    private func makeContext() -> AIPluginContext {
        AIPluginContext(
            logger: .init(subsystem: "test", category: "test"),
            dataDirectory: FileManager.default.temporaryDirectory
        )
    }

    // MARK: - ClaudeLocalPlugin

    @Test("ClaudeLocalPlugin has correct identifier")
    func claudeLocalIdentifier() {
        #expect(ClaudeLocalPlugin.identifier == "com.agentictoolkit.plugin.claude-local")
    }

    @Test("ClaudeLocalPlugin does not require API key")
    func claudeLocalNoAPIKey() {
        let plugin = ClaudeLocalPlugin(context: makeContext())
        #expect(!plugin.requiresAPIKey)
        #expect(plugin.displayName == "Claude (Local)")
        #expect(plugin.capabilities.contains(.streaming))
    }

    // MARK: - ClaudeAPIPlugin

    @Test("ClaudeAPIPlugin has correct identifier")
    func claudeAPIIdentifier() {
        #expect(ClaudeAPIPlugin.identifier == "com.agentictoolkit.plugin.claude-api")
    }

    @Test("ClaudeAPIPlugin has correct properties")
    func claudeAPIProperties() {
        let plugin = ClaudeAPIPlugin(context: makeContext())
        #expect(plugin.displayName == "Claude (API)")
        #expect(plugin.requiresAPIKey)
        #expect(plugin.capabilities.contains(.textCompletion))
        #expect(plugin.capabilities.contains(.streaming))
        #expect(!plugin.availableModels.isEmpty)
        #expect(plugin.availableModels.contains(plugin.recommendedModel))
        #expect(plugin.settingsPanelViewController() != nil)
    }

    // MARK: - OpenAIPlugin

    @Test("OpenAIPlugin has correct identifier")
    func openaiIdentifier() {
        #expect(OpenAIPlugin.identifier == "com.agentictoolkit.plugin.openai")
    }

    @Test("OpenAIPlugin has correct properties")
    func openaiProperties() {
        let plugin = OpenAIPlugin(context: makeContext())
        #expect(plugin.displayName == "OpenAI (ChatGPT)")
        #expect(plugin.requiresAPIKey)
        #expect(plugin.capabilities.contains(.textCompletion))
        #expect(!plugin.availableModels.isEmpty)
        #expect(plugin.availableModels.contains(plugin.recommendedModel))
    }

    // MARK: - GooglePlugin

    @Test("GooglePlugin has correct identifier")
    func googleIdentifier() {
        #expect(GooglePlugin.identifier == "com.agentictoolkit.plugin.google")
    }

    @Test("GooglePlugin has correct properties")
    func googleProperties() {
        let plugin = GooglePlugin(context: makeContext())
        #expect(plugin.displayName == "Google (Gemini)")
        #expect(plugin.requiresAPIKey)
        #expect(!plugin.availableModels.isEmpty)
        #expect(plugin.availableModels.contains(plugin.recommendedModel))
    }

    // MARK: - OpenAICompatiblePlugin

    @Test("OpenAICompatiblePlugin has correct identifier")
    func compatibleIdentifier() {
        #expect(OpenAICompatiblePlugin.identifier == "com.agentictoolkit.plugin.openai-compatible")
    }

    @Test("OpenAICompatiblePlugin has empty model list")
    func compatibleEmptyModels() {
        let plugin = OpenAICompatiblePlugin(context: makeContext())
        #expect(plugin.availableModels.isEmpty)
        #expect(plugin.recommendedModel == "")
        #expect(plugin.requiresAPIKey)
    }

    // MARK: - AIPluginManager Registration

    @Test("registerBuiltIn adds plugin to available and loaded")
    func registerBuiltIn() {
        let manager = AIPluginManager(searchPaths: [])
        manager.registerBuiltIn(ClaudeAPIPlugin.self)

        #expect(manager.availablePlugins.count == 1)
        #expect(manager.availablePlugins.first?.identifier == ClaudeAPIPlugin.identifier)
        #expect(manager.plugin(for: ClaudeAPIPlugin.identifier) != nil)
    }

    @Test("registerBuiltIn skips duplicate registration")
    func registerBuiltInDuplicate() {
        let manager = AIPluginManager(searchPaths: [])
        manager.registerBuiltIn(ClaudeAPIPlugin.self)
        manager.registerBuiltIn(ClaudeAPIPlugin.self)

        #expect(manager.availablePlugins.count == 1)
    }

    @Test("loadPlugin returns registered built-in plugin")
    func loadRegisteredPlugin() throws {
        let manager = AIPluginManager(searchPaths: [])
        manager.registerBuiltIn(ClaudeAPIPlugin.self)

        let plugin = try manager.loadPlugin(identifier: ClaudeAPIPlugin.identifier)
        #expect(plugin.displayName == "Claude (API)")
    }
}

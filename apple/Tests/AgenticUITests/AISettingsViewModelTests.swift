import Testing
import Foundation
@testable import AgenticUI
@testable import AgenticPluginSDK

@MainActor
final class MockPersistence: AISettingsPersistence {
    var storage: [String: String] = [:]

    func loadSetting(key: String) -> String? {
        storage[key]
    }

    func saveSetting(key: String, value: String) {
        storage[key] = value
    }
}

@Suite("AISettingsViewModel")
@MainActor
struct AISettingsViewModelTests {

    @Test("initializes with empty plugin manager")
    func initEmpty() {
        let manager = PluginManager(searchPaths: [])
        manager.discoverPlugins()
        let vm = AISettingsViewModel(pluginManager: manager)
        #expect(vm.selectedPluginIdentifier == "")
        #expect(vm.selectedModel == "")
        #expect(!vm.hasStoredAPIKey)
        #expect(vm.apiKeyTestState == .idle)
    }

    @Test("loads settings from persistence")
    func loadFromPersistence() {
        let manager = PluginManager(searchPaths: [])
        manager.discoverPlugins()
        let persistence = MockPersistence()
        persistence.storage = [
            AISettingsViewModel.pluginKey: "com.test.plugin",
            AISettingsViewModel.modelKey: "test-model",
            AISettingsViewModel.baseURLKey: "https://example.com",
            AISettingsViewModel.enabledKey: "true",
        ]

        let vm = AISettingsViewModel(pluginManager: manager, persistence: persistence)
        #expect(vm.selectedPluginIdentifier == "com.test.plugin")
        #expect(vm.selectedModel == "test-model")
        #expect(vm.baseURL == "https://example.com")
        #expect(vm.isEnabled)
    }

    @Test("saves plugin selection to persistence")
    func savesPluginSelection() {
        let manager = PluginManager(searchPaths: [])
        manager.discoverPlugins()
        let persistence = MockPersistence()

        let vm = AISettingsViewModel(pluginManager: manager, persistence: persistence)
        vm.selectedPluginIdentifier = "com.new.plugin"

        #expect(persistence.storage[AISettingsViewModel.pluginKey] == "com.new.plugin")
    }

    @Test("saves model selection to persistence")
    func savesModelSelection() {
        let manager = PluginManager(searchPaths: [])
        manager.discoverPlugins()
        let persistence = MockPersistence()

        let vm = AISettingsViewModel(pluginManager: manager, persistence: persistence)
        vm.selectedModel = "new-model"

        #expect(persistence.storage[AISettingsViewModel.modelKey] == "new-model")
    }

    @Test("testAPIKey fails when no key entered")
    func testNoKey() {
        let manager = PluginManager(searchPaths: [])
        manager.discoverPlugins()
        let vm = AISettingsViewModel(pluginManager: manager)
        vm.testAPIKey()
        #expect(vm.apiKeyTestState == .failed("No API key entered"))
    }
}

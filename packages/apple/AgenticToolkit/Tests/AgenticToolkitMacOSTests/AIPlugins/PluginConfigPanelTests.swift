import Testing
import AppKit
@testable import AIPluginKit
@testable import AgenticToolkitMacOS

@Suite("PluginConfigPanel")
@MainActor
struct PluginConfigPanelTests {

    @Test("panel embeds a chat view below its config controls")
    func embedsChatView() {
        let descriptor = AIPluginDescriptor(
            identifier: "com.example.panel-test",
            displayName: "Example",
            version: "1.0.0",
            models: ["model-a"]
        )
        let manager = AIPluginManager(searchPaths: [])

        let panel = PluginConfigPanel(descriptor: descriptor, pluginManager: manager)
        _ = panel.view  // triggers loadView + viewDidLoad, building the controls + chat

        #expect(panel.descriptor.title == "Example")
        #expect(panel.settingsView.subviews.contains { $0 is ChatView })
    }
}

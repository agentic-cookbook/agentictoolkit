import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `OpenAICompatiblePlugin`.
@MainActor
final class OpenAICompatibleSettingsPanelViewController: SettingsPanelViewController {

    private let plugin: OpenAICompatiblePlugin

    init(plugin: OpenAICompatiblePlugin) {
        self.plugin = plugin
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "Custom (OpenAI-compatible)" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "server.rack", accessibilityDescription: nil)
    }

    override func loadView() {
        self.view = PluginSettingsContentView(plugin: plugin)
    }
}

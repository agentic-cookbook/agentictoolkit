import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `OpenAIPlugin`.
@MainActor
final class OpenAISettingsPanelViewController: SettingsPanelViewController {

    private let plugin: OpenAIPlugin

    init(plugin: OpenAIPlugin) {
        self.plugin = plugin
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "OpenAI (ChatGPT)" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "sparkle", accessibilityDescription: nil)
    }

    override func loadView() {
        self.view = PluginSettingsContentView(plugin: plugin)
    }
}

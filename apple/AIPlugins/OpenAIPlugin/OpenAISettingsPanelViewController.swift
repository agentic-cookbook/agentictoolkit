import AppKit
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow
import AgenticToolkitAIPluginsCore

/// Settings panel for `OpenAIPlugin`.
@MainActor
final class OpenAISettingsPanelViewController: NSViewController, SettingsPanelViewController {

    private let plugin: any AgenticLLMPlugin

    init(plugin: any AgenticLLMPlugin) {
        self.plugin = plugin
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    var listItem: SettingsPanelListItem {
        SettingsPanelListItem(
            title: "OpenAI (ChatGPT)",
            image: NSImage(systemSymbolName: "sparkle", accessibilityDescription: nil)
        )
    }

    override func loadView() {
        self.view = PluginSettingsContentView(plugin: plugin)
    }
}

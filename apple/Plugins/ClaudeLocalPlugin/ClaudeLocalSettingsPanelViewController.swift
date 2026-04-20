import AppKit
import AgenticAppKit
import AgenticPluginSDK

/// Settings panel for `ClaudeLocalPlugin`.
@MainActor
final class ClaudeLocalSettingsPanelViewController: NSViewController, SettingsPanelViewController {

    private let plugin: any AgenticLLMPlugin

    init(plugin: any AgenticLLMPlugin) {
        self.plugin = plugin
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    var listItem: SettingsPanelListItem {
        SettingsPanelListItem(
            title: "Claude (Local)",
            image: NSImage(systemSymbolName: "terminal", accessibilityDescription: nil)
        )
    }

    override func loadView() {
        self.view = PluginSettingsContentView(plugin: plugin)
    }
}

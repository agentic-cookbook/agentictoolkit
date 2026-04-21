import AppKit
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow
import AgenticToolkitAIPluginsCore
import AgenticToolkitAIPlugins

/// Settings panel for `ClaudeLocalPlugin`.
@MainActor
final class ClaudeLocalSettingsPanelViewController: NSViewController, SettingsPanelViewController {

    private let plugin: ClaudeLocalPlugin

    init(plugin: ClaudeLocalPlugin) {
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

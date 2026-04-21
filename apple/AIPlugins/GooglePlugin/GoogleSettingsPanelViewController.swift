import AppKit
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow
import AgenticToolkitAIPluginsCore

/// Settings panel for `GooglePlugin`.
@MainActor
final class GoogleSettingsPanelViewController: NSViewController, SettingsPanelViewController {

    private let plugin: GooglePlugin

    init(plugin: GooglePlugin) {
        self.plugin = plugin
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    var listItem: SettingsPanelListItem {
        SettingsPanelListItem(
            title: "Google (Gemini)",
            image: NSImage(systemSymbolName: "g.circle", accessibilityDescription: nil)
        )
    }

    override func loadView() {
        self.view = PluginSettingsContentView(plugin: plugin)
    }
}

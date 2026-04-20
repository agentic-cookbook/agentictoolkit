import AppKit
import CoreUI
import SettingsWindow
import AgenticPluginSDK

/// Settings panel for `ClaudeAPIPlugin`.
@MainActor
final class ClaudeAPISettingsPanelViewController: NSViewController, SettingsPanelViewController {

    private let plugin: any AgenticLLMPlugin

    init(plugin: any AgenticLLMPlugin) {
        self.plugin = plugin
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    var listItem: SettingsPanelListItem {
        SettingsPanelListItem(
            title: "Claude (API)",
            image: NSImage(systemSymbolName: "brain", accessibilityDescription: nil)
        )
    }

    override func loadView() {
        self.view = PluginSettingsContentView(plugin: plugin)
    }
}

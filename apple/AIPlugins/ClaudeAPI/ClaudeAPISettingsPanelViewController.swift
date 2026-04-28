import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `ClaudeAPIPlugin`.
@MainActor
final class ClaudeAPISettingsPanelViewController: SettingsPanelViewController {

    private let plugin: ClaudeAPIPlugin

    init(plugin: ClaudeAPIPlugin) {
        self.plugin = plugin
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "Claude (API)" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "brain", accessibilityDescription: nil)
    }

    override func loadView() {
        self.view = PluginSettingsContentView(plugin: plugin)
    }
}

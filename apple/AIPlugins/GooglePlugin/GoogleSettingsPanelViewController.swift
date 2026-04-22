import AppKit
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow
import AgenticToolkitAIPlugins

/// Settings panel for `GooglePlugin`.
@MainActor
final class GoogleSettingsPanelViewController: SettingsPanelViewController {

    private let plugin: GooglePlugin

    init(plugin: GooglePlugin) {
        self.plugin = plugin
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "Google (Gemini)" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "g.circle", accessibilityDescription: nil)
    }

    override func loadView() {
        self.view = PluginSettingsContentView(plugin: plugin)
    }
}

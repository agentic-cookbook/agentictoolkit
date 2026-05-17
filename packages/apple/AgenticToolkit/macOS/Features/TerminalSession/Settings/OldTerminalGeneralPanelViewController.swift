import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS
import AppKit

@MainActor
final class OldTerminalGeneralPanelViewController: OldSettingsPanelViewController {
    override var panelTitle: String { "Terminal" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "terminal", accessibilityDescription: nil)
    }

    override func loadView() {
        view = TerminalSessionGeneralSettingsView()
    }
}

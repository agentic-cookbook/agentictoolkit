import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS
import AppKit

@MainActor
final class OldTerminalProfilesPanelViewController: OldSettingsPanelViewController {
    override var panelTitle: String { "Profiles" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "paintpalette", accessibilityDescription: nil)
    }

    override func loadView() {
        view = TerminalSessionProfilesSettingsView(frame: .zero)
    }
}

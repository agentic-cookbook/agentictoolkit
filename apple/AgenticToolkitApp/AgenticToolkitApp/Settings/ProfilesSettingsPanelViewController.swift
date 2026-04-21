import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitChatWindow
import AgenticToolkitSettingsWindow

@MainActor
final class ProfilesSettingsPanelViewController: SettingsPanelViewController {
    override var panelTitle: String { "Profiles" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "swatchpalette", accessibilityDescription: nil)
    }

    override func loadView() {
        let container = SettingsPanelView(frame: NSRect(x: 0, y: 0, width: 640, height: 480))
        let pane = ProfilesSettingsView(frame: .zero)
        pane.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(pane)
        NSLayoutConstraint.activate([
            pane.topAnchor.constraint(equalTo: container.topAnchor),
            pane.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            pane.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            pane.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        self.view = container
    }
}

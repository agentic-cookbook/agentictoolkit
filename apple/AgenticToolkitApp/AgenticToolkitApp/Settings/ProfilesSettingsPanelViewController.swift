import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

@MainActor
final class ProfilesSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Profiles",
            icon: NSImage(systemSymbolName: "swatchpalette", accessibilityDescription: nil)
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 640, height: 480))
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

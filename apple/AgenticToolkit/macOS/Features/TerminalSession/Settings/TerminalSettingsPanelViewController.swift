import AppKit
import AgenticToolkitCoreMacOS

/// Hosts the existing imperative `TerminalSessionGeneralSettingsView`. Lives
/// in the `AgenticToolkitMacOS` target because `TerminalSessionGeneralSettingsView`
/// itself does — `CoreMacOS` (where most settings panels live) can't reference
/// MacOS-target views without inverting the dependency graph.
@MainActor
public final class TerminalSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public override func loadView() {
        let host = NSView()
        host.translatesAutoresizingMaskIntoConstraints = false
        let inner = TerminalSessionGeneralSettingsView()
        inner.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(inner)
        NSLayoutConstraint.activate([
            inner.topAnchor.constraint(equalTo: host.topAnchor),
            inner.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            inner.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            inner.bottomAnchor.constraint(equalTo: host.bottomAnchor),
        ])
        self.view = host
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        self.descriptor.title = "Terminal"
        self.descriptor.icon = NSImage(systemSymbolName: "terminal", accessibilityDescription: nil)
    }
}

import AppKit
import AgenticToolkitCoreMacOS

/// Hosts the existing imperative `TerminalSessionProfilesSettingsView`. Same
/// rationale as `TerminalSettingsPanelViewController`: lives in the MacOS
/// target because the inner view does.
@MainActor
public final class TerminalProfilesSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public override func loadView() {
        let host = NSView()
        host.translatesAutoresizingMaskIntoConstraints = false
        let inner = TerminalSessionProfilesSettingsView(frame: .zero)
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
        self.descriptor.title = "Profiles"
        self.descriptor.icon = NSImage(systemSymbolName: "paintpalette", accessibilityDescription: nil)
    }
}

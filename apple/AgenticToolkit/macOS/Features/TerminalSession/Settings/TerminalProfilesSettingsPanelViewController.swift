import AppKit
import AgenticToolkitCoreMacOS

/// Hosts the existing imperative `TerminalSessionProfilesSettingsView`. Same
/// rationale as `TerminalSettingsPanelViewController`: lives in the MacOS
/// target because the inner view does.
@MainActor
public final class TerminalProfilesPanelViewController: ComposableSettings.SettingsPanelViewController {

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Profiles",
            icon: NSImage(systemSymbolName: "paintpalette", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

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
            inner.bottomAnchor.constraint(equalTo: host.bottomAnchor)
        ])
        self.view = host
    }
}

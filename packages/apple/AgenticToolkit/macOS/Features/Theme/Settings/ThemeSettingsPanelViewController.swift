import AppKit

/// Hosts `ThemeProfilesSettingsView` as a ComposableSettings panel. Add it to a
/// settings window's `settingPanels` to expose the theme chooser + editor.
@MainActor
public final class ThemeSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Theme",
            icon: NSImage(systemSymbolName: "paintpalette", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func loadView() {
        let host = NSView()
        host.translatesAutoresizingMaskIntoConstraints = false
        let inner = ThemeProfilesSettingsView(frame: .zero)
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

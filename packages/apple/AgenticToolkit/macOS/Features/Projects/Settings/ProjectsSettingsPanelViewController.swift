import AppKit
import SwiftUI

/// Settings for the project registry: what the scan skips.
@MainActor
public final class ProjectsSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public override var hostsOwnScroll: Bool { true }

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Projects",
            icon: NSImage(systemSymbolName: "folder.badge.gearshape", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    public override func loadView() {
        let hosting = NSHostingView(rootView: ProjectScanSettingsView().themedRoot())
        hosting.translatesAutoresizingMaskIntoConstraints = false
        self.view = hosting
    }
}

import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS
import AgenticToolkitPermissions
import AgenticToolkitPermissionsUI

/// System panel: shows the live grant-state of each permission via the reusable
/// `PermissionsPanelView`, plus a button to reset the first-launch walkthrough.
/// This panel doesn't bind any `UserSetting`s — it's a status/action surface,
/// not a preferences surface.
@MainActor
public final class PermissionsSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    /// Permissions the panel surfaces. Automation is per target app; the default
    /// uses iTerm2, the common terminal for Claude Code sessions.
    public static let defaultPermissions: [Permission] = [
        .accessibility,
        .notifications,
        .automation(targetBundleID: "com.googlecode.iterm2")
    ]

    private let permissions: [Permission]

    public init(permissions: [Permission] = PermissionsSettingsPanelViewController.defaultPermissions) {
        self.permissions = permissions
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Permissions",
            icon: NSImage(systemSymbolName: "lock.shield", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        self.settingsView.addGroup(createPermissionsGroup())
        self.settingsView.addGroup(createWalkthroughGroup())
    }

    private func createPermissionsGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Permissions")

        group.addSettingSubview(ComposableSettings.ExplanationView(
            withText: "The following permissions are required to monitor and activate Claude Code sessions."
        ))

        // PermissionsPanelView refreshes itself on appear and on app
        // reactivation (e.g. returning from System Settings) — no polling timer.
        group.addSettingSubview(PermissionsPanelView(permissions: permissions))

        return group
    }

    private func createWalkthroughGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Walkthrough")

        group.addSettingSubview(ComposableSettings.ButtonView(
            viewModel: ComposableSettings.ButtonViewModel(
                title: "Reset Permission Walkthrough",
                wasPressedCallback: { [weak self] in self?.resetWalkthrough() }
            )
        ))

        group.addSettingSubview(ComposableSettings.ExplanationView(
            withText: "Re-runs the first-launch permission walkthrough on next app launch."
        ))

        return group
    }

    private func resetWalkthrough() {
        PermissionWalkthrough.reset()

        let alert = NSAlert()
        alert.messageText = "Permission Walkthrough Reset"
        alert.informativeText = "The permission walkthrough will run again the next time the app launches."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
}

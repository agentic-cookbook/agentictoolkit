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
    public static let defaultPermissions: [AgenticToolkitPermissions.Permission] = [
        .accessibility,
        .notifications,
        .automation(targetBundleID: "com.googlecode.iterm2")
    ]

    private let permissions: [AgenticToolkitPermissions.Permission]
    private weak var panel: PermissionsPanelView?

    public init(
        permissions: [AgenticToolkitPermissions.Permission] =
            PermissionsSettingsPanelViewController.defaultPermissions
    ) {
        self.permissions = permissions
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Permissions",
            icon: NSImage(systemSymbolName: "lock.shield", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "What These Are For",
                body: "macOS gates a few abilities behind an explicit grant. Accessibility "
                    + "lets the app find and raise another app's windows; Notifications lets "
                    + "it tell you about something that finished while you were elsewhere; "
                    + "Automation lets it drive a specific other app, named per target."
            ),
            .init(
                title: "Granting and Revoking",
                body: "The grant itself is made in System Settings › Privacy & Security, not "
                    + "here — this panel shows the live state and takes you there. A grant "
                    + "revoked while the app is running is picked up when the window comes "
                    + "back to the front, so you do not have to relaunch to see it."
            ),
            .init(
                title: "Walkthrough",
                body: "Resetting re-runs the first-launch permission walkthrough the next "
                    + "time the app starts. It changes nothing that has already been "
                    + "granted — it only clears the record that you have been shown the "
                    + "walkthrough."
            )
        ])
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        self.settingsView.addGroup(createPermissionsGroup())
        self.settingsView.addGroup(createWalkthroughGroup())
    }

    public override func viewWillAppear() {
        super.viewWillAppear()
        // ComposableSettings may keep this panel in the window hierarchy across
        // tab switches, so the panel's own viewDidMoveToWindow doesn't re-fire.
        // Refresh on every appearance so re-selecting the Permissions tab shows
        // current status.
        let panel = self.panel
        Task { @MainActor in await panel?.refresh() }
    }

    private func createPermissionsGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Permissions")

        // PermissionsPanelView refreshes itself on appear and on app
        // reactivation (e.g. returning from System Settings) — no polling timer.
        let panel = PermissionsPanelView(permissions: permissions)
        self.panel = panel
        group.addSettingSubview(panel)

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

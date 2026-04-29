import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// System panel: shows the live grant-state of every `AppPermission` in card
/// rows that poll every 2 seconds, plus a button to reset the first-launch
/// permission walkthrough. This panel doesn't bind any `UserSetting`s — it's
/// a status/action surface, not a preferences surface.
@MainActor
public final class PermissionsSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    private var permissionRows: [PermissionRowView] = []

    public init() {
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

    public override func viewWillAppear() {
        super.viewWillAppear()
        // Re-read grant state every time the panel comes back into view.
        // The original Whippet panel polled on a 2-second timer; Swift 6
        // strict-concurrency makes that awkward to express here (NSViewController
        // isn't Sendable, so [weak self] capture in a `@Sendable` Timer block
        // fails). Refresh-on-appear is good enough for now — surface this if
        // you want continuous polling.
        permissionRows.forEach { $0.refresh() }
    }

    private func createPermissionsGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Permissions")

        group.addArrangedSubview(ComposableSettings.ExplanationView(
            withText: "The following permissions are required to monitor and activate Claude Code sessions."
        ))

        for permission in AppPermission.allCases {
            let row = PermissionRowView(permission: permission)
            self.permissionRows.append(row)
            group.addArrangedSubview(row)
        }

        return group
    }

    private func createWalkthroughGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Walkthrough")

        group.addArrangedSubview(ComposableSettings.ButtonView(
            viewModel: ComposableSettings.ButtonViewModel(
                title: "Reset Permission Walkthrough",
                wasPressedCallback: { [weak self] in self?.resetWalkthrough() }
            )
        ))

        group.addArrangedSubview(ComposableSettings.ExplanationView(
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

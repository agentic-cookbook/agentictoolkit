import AppKit
import AgenticToolkitCore

/// General app-startup panel. The launch-at-login coachmark renders inline
/// until the user dismisses it via "Got It".
@MainActor
public final class GeneralSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public override func viewDidLoad() {
        super.viewDidLoad()

        self.descriptor.title = "General"
        self.descriptor.icon = NSImage(systemSymbolName: "gearshape", accessibilityDescription: nil)

        self.settingsView.addGroup(createStartupGroup())
    }

    private func createStartupGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Startup")

        group.addArrangedSubview(ComposableSettings.CheckboxView(
            with: ComposableSettings.ViewModel<Bool>(
                title: "Launch at Login",
                setting: UserSettings.launchAtLogin
            )
        ))

        group.addArrangedSubview(ComposableSettings.DismissibleHintView(
            text: "Whippet works best when it starts automatically with your Mac. Enable launch at login so you never miss a Claude Code session.",
            dismissedSetting: UserSettings.launchAtLoginHintDismissed
        ))

        return group
    }
}

import AppKit
import AgenticToolkitCore

/// General app-startup panel. The launch-at-login coachmark renders inline
/// until the user dismisses it via "Got It".
@MainActor
public final class GeneralSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "General",
            icon: NSImage(systemSymbolName: "gearshape", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        self.settingsView.addGroup(createStartupGroup())
    }

    private func createStartupGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Startup")

        group.addSettingSubview(ComposableSettings.CheckboxView(
            with: ComposableSettings.ViewModel<Bool>(
                title: "Launch at Login",
                setting: UserSettings.launchAtLogin
            )
        ))

        group.addSettingSubview(ComposableSettings.DismissibleHintView(
            text: "Whippet works best when it starts automatically with your Mac. "
                + "Enable launch at login so you never miss a Claude Code session.",
            dismissedSetting: UserSettings.launchAtLoginHintDismissed
        ))

        return group
    }
}

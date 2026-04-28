import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Session window panel: how the session-watcher window behaves and what
/// happens when the user clicks a row.
@MainActor
public final class SessionWindowSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public override func viewDidLoad() {
        super.viewDidLoad()

        self.descriptor.title = "Session Window"
        self.descriptor.icon = NSImage(systemSymbolName: "macwindow", accessibilityDescription: nil)

        self.settingsView.addGroup(createWindowBehaviorGroup())
        self.settingsView.addGroup(createTransparencyGroup())
        self.settingsView.addGroup(createStalenessGroup())
        self.settingsView.addGroup(createClickActionGroup())
        self.settingsView.addGroup(createSummariesGroup())
    }

    private func createWindowBehaviorGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Window Behavior")
        group.addArrangedSubview(ComposableSettings.CheckboxView(
            with: ComposableSettings.ViewModel<Bool>(
                title: "Always on Top",
                setting: UserSettings.sessionWindowAlwaysOnTop
            )
        ))
        return group
    }

    private func createTransparencyGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Transparency")
        group.addArrangedSubview(ComposableSettings.CaptionedSliderView(
            viewModel: ComposableSettings.RangeViewModel<Double>(
                title: "Opacity",
                setting: UserSettings.sessionWindowTransparency,
                minValue: 0.3,
                maxValue: 1.0
            ),
            formatter: { "\(Int($0 * 100))%" }
        ))
        return group
    }

    private func createStalenessGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Staleness Timeout")
        group.addArrangedSubview(ComposableSettings.CaptionedSliderView(
            viewModel: ComposableSettings.RangeViewModel<Double>(
                title: "Timeout",
                setting: UserSettings.sessionStalenessTimeout,
                minValue: 30,
                maxValue: 600
            ),
            formatter: Self.formatTimeoutSeconds
        ))
        group.addArrangedSubview(ComposableSettings.ExplanationView(
            withText: "Sessions with no events within this timeout are marked as stale."
        ))
        return group
    }

    private func createClickActionGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Click Action")

        let actionViewModel = ComposableSettings.ChoiceViewModel<String>(
            title: "On Click",
            setting: UserSettings.sessionClickAction,
            choices: SessionWatcherClickAction.allCases.map {
                .init(label: $0.displayName, value: $0.rawValue, imageSystemName: $0.systemImage)
            }
        )
        group.addArrangedSubview(ComposableSettings.PopupMenuChoiceView(viewModel: actionViewModel))

        let customCommandGroup = ComposableSettings.GroupView(withTitle: "Shell Command Template")
        customCommandGroup.addArrangedSubview(ComposableSettings.TextEditView(
            with: ComposableSettings.ViewModel<String>(
                title: "Command",
                setting: UserSettings.sessionCustomCommand
            )
        ))
        customCommandGroup.addArrangedSubview(ComposableSettings.ExplanationView(
            withText: "Available variables: $SESSION_ID, $CWD, $MODEL"
        ))

        group.addArrangedSubview(ComposableSettings.ConditionalView<String>(
            observing: UserSettings.sessionClickAction,
            child: customCommandGroup
        ) { $0 == SessionWatcherClickAction.customCommand.rawValue })

        return group
    }

    private func createSummariesGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Session Summaries")
        group.addArrangedSubview(ComposableSettings.CheckboxView(
            with: ComposableSettings.ViewModel<Bool>(
                title: "Enable AI session summaries",
                setting: UserSettings.aiSummariesEnabled
            )
        ))
        group.addArrangedSubview(ComposableSettings.ExplanationView(
            withText: "Uses AI to generate a short description of what each session is doing."
        ))
        return group
    }

    private static func formatTimeoutSeconds(_ value: Double) -> String {
        let total = Int(value.rounded())
        if total < 60 { return "\(total)s" }
        let minutes = total / 60
        let remainder = total % 60
        return remainder > 0 ? "\(minutes)m \(remainder)s" : "\(minutes)m"
    }
}

extension UserSettings {

    // `sessionWindowAlwaysOnTop` and `sessionWindowTransparency` are declared
    // in `SessionWatcherPanelWindowController.swift` — reused here.
    // `aiSummariesEnabled` is declared in `AIModelChatConfig.swift` — reused.

    /// Seconds of inactivity before a session is marked stale.
    static var sessionStalenessTimeout = UserSetting<Double>(
        "session_staleness_timeout",
        default: 120
    )

    /// Raw value of `SessionWatcherClickAction` for the click action.
    static var sessionClickAction = UserSetting<String>(
        "session_click_action",
        default: SessionWatcherClickAction.openTerminal.rawValue
    )

    /// Shell command template used when click action is `customCommand`.
    static var sessionCustomCommand = UserSetting<String>(
        "session_custom_command",
        default: ""
    )
}

import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension SessionWatcher {
    
    /// Session window panel: how the session-watcher window behaves and what
    /// happens when the user clicks a row.
    @MainActor
    public final class SettingsPanel: ComposableSettings.SettingsPanelViewController {
        
        public init() {
            super.init(with: ComposableSettings.SettingsPanelDescriptor(
                title: "Session Window",
                icon: NSImage(systemSymbolName: "macwindow", accessibilityDescription: nil)
            ))
        }
        
        public required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }
        
        public override func viewDidLoad() {
            super.viewDidLoad()
            self.settingsView.addGroup(createWindowBehaviorGroup())
            self.settingsView.addGroup(createTransparencyGroup())
            self.settingsView.addGroup(createStalenessGroup())
            self.settingsView.addGroup(createClickActionGroup())
            self.settingsView.addGroup(createSummariesGroup())
            self.settingsView.addGroup(createNotifyWhenGroup())
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
        
        private func createNotifyWhenGroup() -> ComposableSettings.GroupView {
            let group = ComposableSettings.GroupView(withTitle: "Notify When")

            group.addArrangedSubview(ComposableSettings.CheckboxView(
                with: ComposableSettings.ViewModel<Bool>(
                    title: "Session Started",
                    setting: UserSettings.notifySessionStart
                )
            ))

            group.addArrangedSubview(ComposableSettings.CheckboxView(
                with: ComposableSettings.ViewModel<Bool>(
                    title: "Session Ended",
                    setting: UserSettings.notifySessionEnd
                )
            ))

            group.addArrangedSubview(ComposableSettings.CheckboxView(
                with: ComposableSettings.ViewModel<Bool>(
                    title: "Session Became Stale",
                    setting: UserSettings.notifyStale
                )
            ))

            group.addArrangedSubview(ComposableSettings.ExplanationView(
                withText: "Notifications require permission. macOS will prompt you on first use."
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
}


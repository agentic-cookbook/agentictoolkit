import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Notifications panel: which session lifecycle events trigger a macOS
/// notification. The actual notification permission is handled separately
/// (see the System panel); this panel only controls intent.
@MainActor
public final class NotificationsSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public override func viewDidLoad() {
        super.viewDidLoad()

        self.descriptor.title = "Notifications"
        self.descriptor.icon = NSImage(systemSymbolName: "bell", accessibilityDescription: nil)

        self.settingsView.addGroup(createNotifyWhenGroup())
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
}

// `notifySessionStart`, `notifySessionEnd`, and `notifyStale` are declared
// in `SessionWatcherNotificationManager.swift` — reused here without re-declaring.

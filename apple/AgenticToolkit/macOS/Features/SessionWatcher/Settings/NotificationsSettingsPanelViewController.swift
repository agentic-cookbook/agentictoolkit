import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Notifications panel: which session lifecycle events trigger a macOS
/// notification. The actual notification permission is handled separately
/// (see the System panel); this panel only controls intent.
@MainActor
public final class NotificationsSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public init() {
        super.init(with: Descriptor(
            title: "Notifications",
            icon: NSImage(systemSymbolName: "bell", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
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

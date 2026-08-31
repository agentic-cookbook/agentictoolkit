import AgenticToolkitCoreMacOS
import AIPluginKit
import AppKit

/// Settings panel shown when one or more plugins fail to load. Surfaces the
/// count plus each plugin's failure reason so the problem is visible in the UI
/// instead of the panel silently showing nothing.
@MainActor
final class PluginLoadFailuresPanel: ComposableSettings.SettingsPanelViewController {

    private let failures: [PluginLoadFailure]

    init(failures: [PluginLoadFailure]) {
        self.failures = failures

        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: Self.summaryTitle(for: failures),
            icon: NSImage(systemSymbolName: "exclamationmark.triangle", accessibilityDescription: nil)
        ))
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Why a Plugin Fails",
                body: "Provider plugins are loadable bundles in ~/.agenticplugins. macOS "
                    + "refuses to load one whose code signature it can't verify, and the "
                    + "app refuses one built against a different version of the frameworks "
                    + "it links. Either way the reason macOS gave is shown verbatim above."
            ),
            .init(
                title: "Fixing It",
                body: "Rebuild or reinstall the plugin, then relaunch — plugins are loaded "
                    + "once at startup, so a replaced bundle is not picked up while the app "
                    + "is running. A plugin listed here is simply absent: providers that "
                    + "depend on it can't be used, but nothing else is affected."
            )
        ])
    }

    /// "1 plugin failed to load" / "N plugins failed to load". Pure + testable.
    static func summaryTitle(for failures: [PluginLoadFailure]) -> String {
        let count = failures.count
        return "\(count) plugin\(count == 1 ? "" : "s") failed to load"
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let group = ComposableSettings.GroupView(withTitle: Self.summaryTitle(for: failures))
        for failure in failures {
            group.addSettingSubview(
                ComposableSettings.ExplanationView(withText: "\(failure.displayName): \(failure.message)")
            )
        }
        addGroup(group)
    }
}

import AgenticToolkitCoreMacOS
import AppKit

/// The "AI" settings split view. One config panel per *discovered* plugin —
/// built from its descriptor without loading any binary — plus a single failures
/// panel if any plugin's binary could not be loaded.
@MainActor
open class AIPanelViewController: ComposableSettings.SettingsPanelSplitViewController {

    public let pluginManager: AIPluginManager

    public init(pluginManager: AIPluginManager) {
        self.pluginManager = pluginManager

        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "AI",
            icon: NSImage(systemSymbolName: "lock.shield", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        // Configuration UI comes from descriptors alone — no plugin code runs.
        for descriptor in pluginManager.descriptors {
            addPanel(PluginConfigPanel(descriptor: descriptor, pluginManager: pluginManager))
        }

        // Loading binaries is where things can fail; surface any failures.
        let failures = pluginManager.loadAllPlugins().failures
        if !failures.isEmpty {
            addPanel(PluginLoadFailuresPanel(failures: failures))
        }
    }
}

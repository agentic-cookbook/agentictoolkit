import AgenticToolkitCoreMacOS
import AppKit

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

        let result = pluginManager.loadAllPlugins()

        for plugin in result.loaded {
            guard let settingsPanel = plugin.settingsPanelViewController() else {
                continue
            }

            addPanel(settingsPanel)
        }

        if !result.failures.isEmpty {
            addPanel(PluginLoadFailuresPanel(failures: result.failures))
        }
    }
}

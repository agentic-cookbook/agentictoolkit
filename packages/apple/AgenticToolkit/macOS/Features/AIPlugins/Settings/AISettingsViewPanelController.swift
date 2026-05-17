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

        do {
            for plugin in try pluginManager.loadAllPlugins() {
                guard let settingsPanel = plugin.settingsPanelViewController() else {
                    continue
                }

                addPanel(settingsPanel)
            }
        } catch {
            // todo log error
        }
    }
}

import AppKit
import AgenticToolkitSettingsWindow

/// Top-level "Plugins" settings panel. Hosts a nested `SettingsViewController`
/// whose sidebar lists every discovered plugin; selecting one shows the
/// plugin's own vended settings panel.
@MainActor
public final class PluginsSettingsPanelViewController: NSViewController, SettingsPanelViewController {

    private let pluginManager: PluginManager
    private let innerSettings = SettingsViewController()

    public init(pluginManager: PluginManager) {
        self.pluginManager = pluginManager
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public var listItem: SettingsPanelListItem {
        SettingsPanelListItem(
            title: "Plugins",
            image: NSImage(systemSymbolName: "puzzlepiece.fill", accessibilityDescription: nil)
        )
    }

    public override func loadView() {
        self.view = NSView(frame: NSRect(x: 0, y: 0, width: 640, height: 480))
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        for info in pluginManager.availablePlugins {
            do {
                let plugin = try pluginManager.loadPlugin(identifier: info.identifier)
                if let panel = plugin.settingsPanelViewController() {
                    innerSettings.addPanel(panel)
                }
            } catch {
                // Skip plugins that fail to load — they shouldn't appear in the sidebar.
                continue
            }
        }

        addChild(innerSettings)
        innerSettings.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(innerSettings.view)
        NSLayoutConstraint.activate([
            innerSettings.view.topAnchor.constraint(equalTo: view.topAnchor),
            innerSettings.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            innerSettings.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            innerSettings.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }
}

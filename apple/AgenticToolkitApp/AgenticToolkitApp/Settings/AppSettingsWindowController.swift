import AppKit
import AgenticToolkitAIPlugins
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow

/// Test-app Settings window controller. Subclasses the toolkit base to
/// compose the panels visible in this app — host-owned (appearance,
/// profiles, system) plus the nested `AIPlugins` panel.
@MainActor
final class AppSettingsWindowController: SettingsWindowController {

    private var databaseManager: DatabaseManager?
    private var pluginManager: AIPluginManager?
    private(set) var viewModel: SettingsViewModel?

    func configure(databaseManager: DatabaseManager, pluginManager: AIPluginManager) {
        self.databaseManager = databaseManager
        self.pluginManager = pluginManager
    }

    override var windowTitle: String { "AgenticPluginTester Settings" }

    override func makeSettingsPanels() -> [SettingsPanelViewController] {
        ensureViewModel()
        guard let pm = pluginManager else {
            Log.app.error("Cannot show settings without plugin manager")
            return []
        }

        var panels: [SettingsPanelViewController] = []
        if let vm = viewModel {
            panels.append(AppearanceSettingsPanelViewController(viewModel: vm))
            panels.append(ProfilesSettingsPanelViewController())
            panels.append(SystemSettingsPanelViewController(viewModel: vm))
        }
        panels.append(AIPluginsSettingsPanelViewController(pluginManager: pm))
        return panels
    }

    private func ensureViewModel() {
        guard viewModel == nil, let db = databaseManager, let pm = pluginManager else { return }
        let launchAtLoginManager = LaunchAtLoginManager(databaseManager: db)
        viewModel = SettingsViewModel(
            databaseManager: db,
            pluginManager: pm,
            launchAtLoginManager: launchAtLoginManager
        )
    }
}

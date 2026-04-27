import AppKit
import AgenticToolkitAIPlugins
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow
import OSLog

/// Test-app Settings window controller. Subclasses the toolkit base to
/// compose the panels visible in this app — host-owned (appearance,
/// profiles, system) plus the nested `AIPlugins` panel.
@MainActor
final class AppSettingsWindowController: SettingsWindowController {

    private var SessionsDatabaseManager: SessionsDatabaseManager?
    private var pluginManager: AIPluginManager?
    private(set) var viewModel: SettingsViewModel?

    func configure(SessionsDatabaseManager: SessionsDatabaseManager, pluginManager: AIPluginManager) {
        self.SessionsDatabaseManager = SessionsDatabaseManager
        self.pluginManager = pluginManager
    }

    override var windowTitle: String { "AgenticPluginTester Settings" }

    override func makeSettingsPanels() -> [SettingsPanelViewController] {
        ensureViewModel()
        guard let pm = pluginManager else {
            logger.error("Cannot show settings without plugin manager")
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
        guard viewModel == nil, let db = SessionsDatabaseManager, let pm = pluginManager else { return }
        let launchAtLoginManager = LaunchAtLoginManager(SessionsDatabaseManager: db)
        viewModel = SettingsViewModel(
            SessionsDatabaseManager: db,
            pluginManager: pm,
            launchAtLoginManager: launchAtLoginManager
        )
    }
}

extension AppSettingsWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}

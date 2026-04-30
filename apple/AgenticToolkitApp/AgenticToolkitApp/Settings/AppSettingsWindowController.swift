import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS
import OSLog

/// Test-app Settings window controller. Subclasses the toolkit base to
/// compose the panels visible in this app — host-owned (appearance,
/// profiles, system) plus the nested `AIPlugins` panel.
@MainActor
final class AppSettingsWindowController: ComposableSettings.SettingsWindow {

    private var sessionsDatabaseManager: SessionsDatabaseManager?
    private var pluginManager: AIPluginManager?
    private(set) var viewModel: SettingsViewModel?

    func configure(SessionsDatabaseManager: SessionsDatabaseManager, pluginManager: AIPluginManager) {
        self.sessionsDatabaseManager = SessionsDatabaseManager
        self.pluginManager = pluginManager
        self.windowTitle = "AgenticPluginTester Settings"
        self.settingPanels = makeSettingsPanels()
    }

    private func makeSettingsPanels() -> [any ComposableSettingsPanel] {
        ensureViewModel()
        guard let pm = pluginManager else {
            logger.error("Cannot show settings without plugin manager")
            return []
        }

        var panels: [any ComposableSettingsPanel] = []
        if let vm = viewModel {
            panels.append(AppearanceSettingsPanelViewController(viewModel: vm))
            panels.append(ProfilesSettingsPanelViewController())
            panels.append(SystemSettingsPanelViewController(viewModel: vm))
        }
        panels.append(AIPanelViewController(pluginManager: pm))
        return panels
    }

    private func ensureViewModel() {
        guard viewModel == nil, let db = sessionsDatabaseManager, let pm = pluginManager else { return }
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

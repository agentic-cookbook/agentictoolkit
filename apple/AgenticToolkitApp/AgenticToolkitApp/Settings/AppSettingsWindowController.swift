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
    private var mcpRegistry: MCPServerRegistry?
    private var settingsStore: SettingsStore?
    private(set) var viewModel: SettingsViewModel?

    func configure(
        sessionsDatabaseManager: SessionsDatabaseManager,
        pluginManager: AIPluginManager,
        mcpRegistry: MCPServerRegistry,
        settingsStore: SettingsStore
    ) {
        self.sessionsDatabaseManager = sessionsDatabaseManager
        self.pluginManager = pluginManager
        self.mcpRegistry = mcpRegistry
        self.settingsStore = settingsStore
        self.windowTitle = "AgenticPluginTester Settings"
        self.settingPanels = makeSettingsPanels()
    }

    private func makeSettingsPanels() -> [any ComposableSettingsPanel] {
        ensureViewModel()
        guard let pluginManager = pluginManager else {
            logger.error("Cannot show settings without plugin manager")
            return []
        }

        var panels: [any ComposableSettingsPanel] = []
        if let viewModel = viewModel {
            panels.append(AppearanceSettingsPanelViewController(viewModel: viewModel))
            panels.append(ProfilesSettingsPanelViewController())
            panels.append(SystemSettingsPanelViewController(viewModel: viewModel))
        }
        panels.append(AIPanelViewController(pluginManager: pluginManager))
        if let mcpRegistry = mcpRegistry, let settingsStore = settingsStore {
            panels.append(MCPServersPanelViewController(registry: mcpRegistry, store: settingsStore))
        }
        return panels
    }

    private func ensureViewModel() {
        guard viewModel == nil,
              let database = sessionsDatabaseManager,
              let pluginManager = pluginManager else { return }
        let launchAtLoginManager = LaunchAtLoginManager(sessionsDatabaseManager: database)
        viewModel = SettingsViewModel(
            sessionsDatabaseManager: database,
            pluginManager: pluginManager,
            launchAtLoginManager: launchAtLoginManager
        )
    }
}

extension AppSettingsWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}

import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

@MainActor
class Features {
    let appearanceManager: AppearanceManager
    let permissionWalkthrough: PermissionWalkthrough
    let terminalCoordinator: TerminalCoordinator
    let aiPluginsCoordinator: AIPluginsCoordinator
    let aiChatCoordinator: AIChatCoordinator
    let summarizerDebug: SessionWatcher.SummarizerDebugCoordinator
    let sessionWatcherCoordinator: SessionWatcher.SessionWatcherCoordinator
    let settingsCoordinator: ComposableSettings.AppCoordinator

    let menuManager: MenuManager

    init() {
        self.appearanceManager = AppearanceManager()
        self.permissionWalkthrough = PermissionWalkthrough()
        self.aiPluginsCoordinator = AIPluginsCoordinator(appName: "AgenticPluginTester")
        self.terminalCoordinator = TerminalCoordinator()
        self.summarizerDebug = SessionWatcher.SummarizerDebugCoordinator()
        self.sessionWatcherCoordinator = SessionWatcher.SessionWatcherCoordinator()

        self.aiChatCoordinator = AIChatCoordinator(makeBackend: {
            let config = AIModelChatConfig(
                aiProvider: AIProvider(rawValue: UserSettings.aiProvider.currentValue) ?? .anthropic,
                aiModel: UserSettings.aiModel.currentValue,
                aiBaseURL: UserSettings.aiBaseURL.currentValue,
                apiKey: UserSettings.aiAPIKey.currentValue,
                aiSummariesEnabled: UserSettings.aiSummariesEnabled.currentValue
            )
            return WhippetChatBackend(aiInfo: config)
        })

        self.settingsCoordinator = ComposableSettings.AppCoordinator(
            windowTitle: "Agentic Toolkit Settings",
            settingsPanels: [
                AppearanceSettingsPanelViewController(),
                GeneralSettingsPanelViewController(),
                SessionWatcher.SettingsPanel(),
                PermissionsSettingsPanelViewController()
            ]
        )

        self.menuManager = MenuManager()
    }

    func start() {
        logger.info("Agentic Toolkit launching")

        settingsCoordinator.addPanel(aiPluginsCoordinator.settingsPanel())

        for feature in AppFeatureRegistry.shared.features {
            do {
                try feature.start()
            } catch {
                let name = String(describing: type(of: feature))
                logger.error(
                    "Feature start failed: \(name, privacy: .public): \(error.localizedDescription, privacy: .public)"
                )
            }
        }

        menuManager.install(contributors: AppFeatureRegistry.shared.features)

        logger.info("Agentic Toolkit launch complete — all subsystems initialized")

        permissionWalkthrough.runIfNeeded { [weak self] in
            guard let self else { return }
            logger.info("finished walkthrough: \(type(of: self))")
        }
    }

    func stop() {
        logger.info("Agentic Toolkit terminating")
        let captured = AppFeatureRegistry.shared.features
        Task {
            for feature in captured { await feature.terminate() }
        }
        AppFeatureRegistry.shared.stopAll()
        logger.info("Agentic Toolkit shutdown complete")
    }
}

extension Features: Loggable {
    public static nonisolated let logger = makeLogger()
}

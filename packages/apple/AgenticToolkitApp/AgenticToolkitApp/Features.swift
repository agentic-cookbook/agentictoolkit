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
    let chatConfigProvider: PluginChatConfigProvider
    let aiChatCoordinator: AIChatCoordinator
    let summarizerDebug: SessionWatcher.SummarizerDebugCoordinator
    let sessionWatcherCoordinator: SessionWatcher.SessionWatcherCoordinator
    let windowContextsCoordinator: WindowContextsCoordinator
    let settingsCoordinator: ComposableSettings.AppCoordinator

    let menuManager: MenuManager

    init() {
        self.appearanceManager = AppearanceManager()
        self.permissionWalkthrough = PermissionWalkthrough()
        let aiPluginsCoordinator = AIPluginsCoordinator(appName: "AgenticPluginTester")
        self.aiPluginsCoordinator = aiPluginsCoordinator
        self.terminalCoordinator = TerminalCoordinator()
        self.summarizerDebug = SessionWatcher.SummarizerDebugCoordinator()
        self.sessionWatcherCoordinator = SessionWatcher.SessionWatcherCoordinator()
        self.windowContextsCoordinator = WindowContextsCoordinator()

        // Chat runs through the loaded plugins: the config provider reports the
        // user's selection (from the AI settings panel) and the backend asks the
        // selected plugin to describe each request.
        let chatConfigProvider = PluginChatConfigProvider(pluginManager: aiPluginsCoordinator.pluginManager)
        self.chatConfigProvider = chatConfigProvider
        self.aiChatCoordinator = AIChatCoordinator(makeBackend: {
            AIPluginChatBackend(
                pluginManager: aiPluginsCoordinator.pluginManager,
                configProvider: chatConfigProvider
            )
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

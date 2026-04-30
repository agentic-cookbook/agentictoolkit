import AppKit
import OSLog
import AgenticToolkitCore

extension SessionWatcher {

    /// Owns the SessionWatcher feature stack — database, event ingestion, liveness
    /// monitor, notification manager, summarizer, and shell hook installer — plus
    /// the panel window controller it drives. Wires every cross-feature callback
    /// AppDelegate used to glue together by hand.
    ///
    /// As an `AppFeature`, hosts call `start()` after the permission walkthrough
    /// succeeds and `stop()` from `applicationWillTerminate`. As a `MenuContributor`,
    /// the coordinator vends "Show Sessions", "Window Discovery" and a developer
    /// "Test Window Activation" item; the host's `MenuManager` collects them.
    /// As a `ScriptingContributor` it owns every panel/session KVC key Cocoa
    /// Scripting reaches for.
    @MainActor
    public final class SessionWatcherCoordinator: AppFeature {

        public let databaseManager: SessionWatcherDatabaseManager
        public let ingestionManager: SessionWatcherEventIngestionManager
        public let livenessMonitor: SessionWatcherLivenessMonitor
        public let notificationManager: SessionWatcherNotificationManager
        public let summarizer: SessionWatcherSummarizer
        public let hookInstaller: SessionWatcherHookInstaller
        public let windowController: SessionWatcherWindowController

        public init(
            settingsStore: SettingsStore = UserSettings.shared
        ) {
            let databaseManager = SessionWatcherDatabaseManager()
            self.databaseManager     = databaseManager
            self.windowController    = SessionWatcherWindowController(databaseManager: databaseManager)
            self.ingestionManager    = SessionWatcherEventIngestionManager(
                sessionWatcherDatabaseManager: databaseManager
            )
            self.livenessMonitor     = SessionWatcherLivenessMonitor(
                sessionWatcherDatabaseManager: databaseManager
            )
            self.notificationManager = SessionWatcherNotificationManager(settingsStore: settingsStore)
            self.summarizer          = SessionWatcherSummarizer(
                sessionWatcherDatabaseManager: databaseManager,
                settingsStore: settingsStore
            )
            self.hookInstaller       = SessionWatcherHookInstaller()
            super.init()

            self.menuContributions =  [
                MenuContribution(slot: .window, title: "Session Window", order: 10, key: "1") { [weak self] in
                    self?.windowController.togglePanel()
                },
//                MenuContribution(slot: .window, title: "Window Discovery", order: 20, key: "2") { [weak self] in
//                    self?.showWindowDiscovery()
//                },
                MenuContribution(
                    slot: .statusItem(section: 0),
                    title: "Show Sessions",
                    order: 0,
                    key: "s"
                ) { [weak self] in
                    self?.windowController.togglePanel()
                },
                MenuContribution(
                    slot: .statusItem(section: 3),
                    title: "Test Window Activation",
                    order: 0,
                    key: "t"
                ) { [weak self] in
                    self?.runWindowActivationTest()
                }
            ]

            self.scriptingKeys = [
                "sessions",
                "scriptingSettings",
                "scriptingSessionCount",
                "scriptingActiveSessionCount",
                "scriptingPanelVisible",
                "scriptingPanelFloating",
                "scriptingPanelTransparency"
            ]

            windowController.setSessionSummarizer(self.summarizer)
            ingestionManager.sessionSummarizer = summarizer

            self.wireNotifications()
            self.wireIngestionToPanelErrors()
        }

        // MARK: - AppFeature

        /// Boot order: refresh shell hooks, request notification authorization,
        /// start ingestion + liveness, then trigger a one-shot summarize-existing
        /// pass for sessions that already had data when the app launched.
        /// Restores prior panel visibility (the panel was open the last time the
        /// user quit on first launch).
        public override func start() throws {
            _ = hookInstaller.uninstallHooks()
            let result = hookInstaller.installHooks()
            switch result {
            case .installed:        Self.logger.info("Hooks installed")
            case .alreadyInstalled: Self.logger.info("Hooks already installed")
            case .failed(let err):  Self.logger.error("Hook install failed: \(err, privacy: .public)")
            }

            notificationManager.requestAuthorization()
            try ingestionManager.start()
            livenessMonitor.start()
            ingestionManager.summarizeExistingSessions()

            if SessionWatcherWindowController.shouldShowOnLaunch() {
                windowController.showPanel()
            }
        }

        /// Graceful shutdown — stop the long-running monitors before the app exits.
        public override func stop() {
            livenessMonitor.stop()
            ingestionManager.stop()
        }

        // MARK: - MenuContributor

//        private func showWindowDiscovery() {
//            guard let vm = windowController.viewModel else { return }
//            let allSessions = vm.groups.flatMap(\.sessions)
//            let session = allSessions.first(where: { $0.sessionId == vm.frontmostSessionId })
//            ?? allSessions.first
//            if let session {
//                windowController.showWindowDiscovery(for: session)
//            }
//        }

        private func runWindowActivationTest() {
            let sessions = (try? databaseManager.fetchAllSessions()) ?? []
            let targets: [WindowActivationTarget] = sessions
                .filter { $0.status != .ended && $0.pid > 0 }
                .map { session in
                    WindowActivationTarget(
                        identifier: session.sessionId,
                        projectName: session.projectName,
                        cwd: session.cwd,
                        pid: session.pid,
                        termProgram: session.termProgram
                    )
                }
            let log = ActivationTestLog.whippetShared
            let tester = WindowActivationTester(targets: targets, log: log)
            DispatchQueue.global(qos: .userInitiated).async {
                tester.runAllTests()
                DispatchQueue.main.async {
                    if let logPath = log.logPath {
                        NSWorkspace.shared.open(URL(fileURLWithPath: logPath))
                        Self.logger.info("Activation test complete — log at \(logPath)")
                    } else {
                        Self.logger.warning("Activation test complete — no log file")
                    }
                }
            }
        }

        // MARK: - ScriptingContributor

        public override func value(forScriptingKey key: String) -> Any? {
            switch key {
            case "sessions":
                return ((try? databaseManager.fetchAllSessions()) ?? []).map(ScriptableSession.init(session:))
            case "scriptingSettings":
                return ((try? databaseManager.fetchAllSettings()) ?? [:]).map {
                    ScriptableSetting(
                        name: $0.key,
                        value: $0.value,
                        sessionWatcherDatabaseManager: databaseManager
                    )
                }
            case "scriptingSessionCount":
                return (try? databaseManager.fetchAllSessions())?.count ?? 0
            case "scriptingActiveSessionCount":
                return (try? databaseManager.fetchAllSessions(status: .active))?.count ?? 0
            case "scriptingPanelVisible":
                return windowController.isVisible
            case "scriptingPanelFloating":
                return windowController.isFloating
            case "scriptingPanelTransparency":
                return Double(windowController.transparency)
            default:
                return nil
            }
        }

        public override func setValue(_ value: Any?, forScriptingKey key: String) {
            switch key {
            case "scriptingPanelVisible":
                if (value as? Bool) == true {
                    windowController.showPanel()
                } else {
                    windowController.hidePanel()
                }
            case "scriptingPanelFloating":
                if let flag = value as? Bool { windowController.isFloating = flag }
            case "scriptingPanelTransparency":
                if let amount = value as? Double { windowController.transparency = CGFloat(amount) }
            default:
                break
            }
        }

        /// Cocoa Scripting indexed accessor: `tell application "Whippet" to get session "X"`.
        public func session(uniqueID: String) -> ScriptableSession? {
            guard let session = try? databaseManager.fetchSession(bySessionId: uniqueID) else { return nil }
            return ScriptableSession(session: session)
        }

        /// Cocoa Scripting indexed accessor: `tell application "Whippet" to get setting "X"`.
        public func scriptableSetting(named name: String) -> ScriptableSetting? {
            let value = (try? databaseManager.getSetting(key: name)) ?? nil
            return ScriptableSetting(
                name: name,
                value: value ?? "",
                sessionWatcherDatabaseManager: databaseManager
            )
        }

        // MARK: - Internal wiring

        private func wireNotifications() {
            ingestionManager.onEventIngested = { [weak self] eventType, sessionId, projectName in
                guard let self else { return }
                switch eventType {
                case "SessionStart":
                    self.notificationManager.notifySessionStart(sessionId: sessionId, projectName: projectName)
                case "SessionEnd":
                    self.notificationManager.notifySessionEnd(sessionId: sessionId, projectName: projectName)
                default:
                    break
                }
            }
            livenessMonitor.onSessionMarkedStale = { [weak self] sessionId, projectName in
                self?.notificationManager.notifySessionStale(sessionId: sessionId, projectName: projectName)
            }
            livenessMonitor.onSessionProcessDied = { [weak self] sessionId, projectName in
                self?.notificationManager.notifySessionEnd(sessionId: sessionId, projectName: projectName)
            }
            notificationManager.onNotificationClicked = { [weak self] in
                self?.windowController.showPanel()
            }
        }

        private func wireIngestionToPanelErrors() {
            ingestionManager.onSummarizerError = { [weak self] message in
                guard let self else { return }
                let display = "Summarizer: \(message)"
                self.windowController.viewController?.viewModel.lastActionError = display
                // Auto-clear after 10s, but only if no other error replaced ours.
                DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
                    let viewModel = self?.windowController.viewController?.viewModel
                    if viewModel?.lastActionError?.hasPrefix("Summarizer") == true {
                        viewModel?.lastActionError = nil
                    }
                }
            }
        }
    }
}
extension SessionWatcher.SessionWatcherCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}

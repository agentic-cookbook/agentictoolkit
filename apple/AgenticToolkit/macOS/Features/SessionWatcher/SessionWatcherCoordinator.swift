import AppKit
import OSLog
import AgenticToolkitCore

/// Owns the SessionWatcher feature stack — database, event ingestion, liveness
/// monitor, notification manager, summarizer, and shell hook installer — and
/// wires every cross-feature callback that AppDelegate used to glue together
/// by hand.
///
/// Hosts construct one and hand it the panel window controller they want
/// driven; the coordinator handles `setDatabaseManager`, summarizer assignment,
/// notification routing, and error display. Hosts call `start()` after the
/// permission walkthrough succeeds and `stop()` from
/// `applicationWillTerminate`.
@MainActor
public final class SessionWatcherCoordinator {

    public let databaseManager: SessionWatcherDatabaseManager
    public let ingestionManager: SessionWatcherEventIngestionManager
    public let livenessMonitor: SessionWatcherLivenessMonitor
    public let notificationManager: SessionWatcherNotificationManager
    public let summarizer: SessionWatcherSummarizer
    public let hookInstaller: SessionWatcherHookInstaller

    private weak var panelController: SessionWatcherPanelWindowController?

    public init(
        panelController: SessionWatcherPanelWindowController,
        settingsStore: SettingsStore = UserSettings.shared
    ) throws {
        self.panelController     = panelController
        self.databaseManager     = try SessionWatcherDatabaseManager()
        self.ingestionManager    = SessionWatcherEventIngestionManager(SessionWatcherDatabaseManager: databaseManager)
        self.livenessMonitor     = SessionWatcherLivenessMonitor(SessionWatcherDatabaseManager: databaseManager)
        self.notificationManager = SessionWatcherNotificationManager(settingsStore: settingsStore)
        self.summarizer          = SessionWatcherSummarizer(SessionWatcherDatabaseManager: databaseManager,
                                                            settingsStore: settingsStore)
        self.hookInstaller       = SessionWatcherHookInstaller()

        panelController.setDatabaseManager(databaseManager)
        panelController.viewModel?.sessionSummarizer = summarizer
        ingestionManager.sessionSummarizer = summarizer

        wireNotifications()
        wireIngestionToPanelErrors()
    }

    /// Boot order: refresh shell hooks, request notification authorization,
    /// start ingestion + liveness, then trigger a one-shot summarize-existing
    /// pass for sessions that already had data when the app launched.
    public func start() throws {
        // Always reinstall to pick up hook command updates.
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
    }

    /// Graceful shutdown — stop the long-running monitors before the app exits.
    public func stop() {
        livenessMonitor.stop()
        ingestionManager.stop()
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
            self?.panelController?.showPanel()
        }
    }

    private func wireIngestionToPanelErrors() {
        ingestionManager.onSummarizerError = { [weak self] message in
            guard let self else { return }
            let display = "Summarizer: \(message)"
            self.panelController?.viewModel?.lastActionError = display
            // Auto-clear after 10s, but only if no other error replaced ours.
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
                if self?.panelController?.viewModel?.lastActionError?.hasPrefix("Summarizer") == true {
                    self?.panelController?.viewModel?.lastActionError = nil
                }
            }
        }
    }
}

extension SessionWatcherCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}

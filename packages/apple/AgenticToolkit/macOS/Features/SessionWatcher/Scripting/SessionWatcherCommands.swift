import AppKit
import OSLog
import AgenticToolkitCore

extension SessionWatcher {

    @MainActor
    fileprivate static var coordinator: SessionWatcherCoordinator? {
        NSApp.scriptingHost?.feature(SessionWatcherCoordinator.self)
    }

    // MARK: - Panel commands

    @objc(ShowPanelCommand)
    public final class ShowPanelCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            SessionWatcher.coordinator?.windowController.showPanel()
            return nil
        }
    }

    @objc(HidePanelCommand)
    public final class HidePanelCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            SessionWatcher.coordinator?.windowController.hidePanel()
            return nil
        }
    }

    @objc(TogglePanelCommand)
    public final class TogglePanelCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            SessionWatcher.coordinator?.windowController.togglePanel()
            return nil
        }
    }

    // MARK: - Refresh

    @objc(RefreshSessionsCommand)
    public final class RefreshSessionsCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            let viewModel = SessionWatcher.coordinator?.windowController.viewController?.viewModel
            viewModel?.loadSessions()
            return viewModel?.sessionCount ?? 0
        }
    }

    // MARK: - Summarize

    @objc(SummarizeSessionCommand)
    public final class SummarizeSessionCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            guard let scriptableSession = evaluatedReceivers as? ScriptableSession
                    ?? (evaluatedReceivers as? [ScriptableSession])?.first else {
                guard let specifier = directParameter as? NSScriptObjectSpecifier,
                      let session = specifier.objectsByEvaluatingSpecifier as? ScriptableSession else {
                    scriptErrorNumber = errOSACantAssign
                    scriptErrorString = "Could not resolve session."
                    return nil
                }
                return summarize(session)
            }
            return summarize(scriptableSession)
        }

        @MainActor
        private func summarize(_ scriptableSession: ScriptableSession) -> String {
            let sessionId = scriptableSession.session.sessionId
            guard let watcher = SessionWatcher.coordinator else {
                scriptErrorNumber = errOSACantAssign
                scriptErrorString = "Session summarizer is not available."
                return ""
            }
            let summarizer = watcher.summarizer
            let database = watcher.databaseManager

            // Box ferries the result out of the @Sendable Task closure;
            // the semaphore enforces happens-before so the unchecked Sendable
            // is safe.
            final class Box: @unchecked Sendable { var value = "" }
            let box = Box()
            let semaphore = DispatchSemaphore(value: 0)
            Task {
                do {
                    try await summarizer.summarizeAndStore(sessionId: sessionId)
                    if let updated = try? database.fetchSession(bySessionId: sessionId) {
                        box.value = updated.summary
                    }
                } catch {
                    Self.logger.error("Scripting summarize failed: \(error.localizedDescription, privacy: .public)")
                }
                semaphore.signal()
            }
            // Wait up to 30 seconds for AI summarization
            _ = semaphore.wait(timeout: .now() + 30)
            return box.value
        }
    }

    // MARK: - Activate

    @objc(ActivateSessionCommand)
    public final class ActivateSessionCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            guard let specifier = directParameter as? NSScriptObjectSpecifier,
                  let scriptableSession = specifier.objectsByEvaluatingSpecifier as? ScriptableSession else {
                scriptErrorNumber = errOSACantAssign
                scriptErrorString = "Could not resolve session."
                return nil
            }

            guard SessionWatcher.coordinator?.databaseManager != nil else {
                scriptErrorNumber = errOSACantAssign
                scriptErrorString = "Database not available."
                return nil
            }

            let session = scriptableSession.session
            let actionOverride = evaluatedArguments?["actionOverride"] as? String
            let actionHandler = SessionWatcherActionHandler(settingsStore: UserSettings.shared)

            let action: SessionWatcherClickAction
            if let override = actionOverride, let parsed = SessionWatcherClickAction(rawValue: override) {
                action = parsed
            } else {
                action = actionHandler.currentAction
            }

            switch actionHandler.execute(action: action, for: session) {
            case .success:    return "OK"
            case .failure(let error): return "Failed: \(error)"
            }
        }
    }

    // MARK: - Delete

    @objc(DeleteSessionCommand)
    public final class DeleteSessionCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            guard let specifier = directParameter as? NSScriptObjectSpecifier,
                  let scriptableSession = specifier.objectsByEvaluatingSpecifier as? ScriptableSession else {
                scriptErrorNumber = errOSACantAssign
                scriptErrorString = "Could not resolve session."
                return nil
            }

            guard let watcher = SessionWatcher.coordinator else {
                scriptErrorNumber = errOSACantAssign
                scriptErrorString = "Database not available."
                return nil
            }

            do {
                try watcher.databaseManager.deleteSession(sessionId: scriptableSession.session.sessionId)
                watcher.windowController.viewController?.viewModel.loadSessions()
            } catch {
                scriptErrorNumber = errOSACantAssign
                scriptErrorString = "Failed to delete session: \(error.localizedDescription)"
            }
            return nil
        }
    }

    // MARK: - Window discovery

    @objc(ShowWindowDiscoveryCommand)
    public final class ShowWindowDiscoveryCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            SessionWatcher.coordinator?.setValue(true, forScriptingKey: "scriptingWindowDiscoveryVisible")
            return nil
        }
    }

    @objc(HideWindowDiscoveryCommand)
    public final class HideWindowDiscoveryCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            // The window-discovery hide path was removed in the coordinator
            // refactor; left as a no-op so existing scripts don't error.
            nil
        }
    }
}

extension SessionWatcher.SummarizeSessionCommand: Loggable {
    public static nonisolated let logger = makeLogger()
}

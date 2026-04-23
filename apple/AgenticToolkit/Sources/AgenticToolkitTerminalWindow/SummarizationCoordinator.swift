import AgenticToolkitAIProvider
import AgenticToolkitCore
import Combine
import Foundation
import os

/// Host app hook for supplying summarization settings on demand. The coordinator calls
/// `currentSettings()` each time it needs to summarize, so UI changes take effect
/// without reconfiguring the coordinator.
public protocol SummarizationSettingsProviding: AnyObject, Sendable {
    @MainActor func currentSettings() -> SummarizationSettings
}

/// Coordinates when to invoke the AI session summarizer.
///
/// Observes terminal session changes (directory, foreground process) and triggers
/// debounced summarization. Also runs a periodic refresh for the selected session.
@MainActor
public final class SummarizationCoordinator {

    private weak var sessionManager: TerminalSessionManager?
    private let settingsProvider: SummarizationSettingsProviding

    private var pendingWork: [UUID: Task<Void, Never>] = [:]
    private var subscriptions: [UUID: Set<AnyCancellable>] = [:]
    private var lastContentHashes: [UUID: Int] = [:]
    private var sessionListCancellable: AnyCancellable?
    nonisolated(unsafe) private var periodicTimer: Timer?

    private let debounceDelay: TimeInterval = 5.0
    private let periodicInterval: TimeInterval = 60.0

    public init(sessionManager: TerminalSessionManager, settingsProvider: SummarizationSettingsProviding) {
        self.sessionManager = sessionManager
        self.settingsProvider = settingsProvider

        sessionListCancellable = sessionManager.$sessions
            .sink { [weak self] sessions in
                MainActor.assumeIsolated {
                    self?.syncObservations(to: sessions)
                }
            }

        periodicTimer = Timer.scheduledTimer(withTimeInterval: periodicInterval, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.periodicRefresh()
            }
        }
    }

    deinit {
        periodicTimer?.invalidate()
    }

    /// Immediately triggers summarization for a session (on-demand, no debounce).
    public func summarizeNow(session: TerminalSession) {
        scheduleSummarization(for: session, delay: 0)
    }

    private func syncObservations(to sessions: [TerminalSession]) {
        let currentIDs = Set(sessions.map(\.id))
        let observedIDs = Set(subscriptions.keys)

        for removedID in observedIDs.subtracting(currentIDs) {
            subscriptions.removeValue(forKey: removedID)
            pendingWork[removedID]?.cancel()
            pendingWork.removeValue(forKey: removedID)
            lastContentHashes.removeValue(forKey: removedID)
        }

        for session in sessions where !observedIDs.contains(session.id) {
            observe(session: session)
        }
    }

    private func observe(session: TerminalSession) {
        var cancellables = Set<AnyCancellable>()

        session.$currentDirectory
            .dropFirst()
            .removeDuplicates()
            .sink { [weak self, weak session] _ in
                guard let session else { return }
                MainActor.assumeIsolated {
                    self?.scheduleSummarization(for: session)
                }
            }
            .store(in: &cancellables)

        session.$foregroundProcess
            .dropFirst()
            .removeDuplicates()
            .sink { [weak self, weak session] _ in
                guard let session else { return }
                MainActor.assumeIsolated {
                    self?.scheduleSummarization(for: session)
                }
            }
            .store(in: &cancellables)

        subscriptions[session.id] = cancellables
    }

    private func scheduleSummarization(for session: TerminalSession, delay: TimeInterval? = nil) {
        let effectiveDelay = delay ?? debounceDelay
        let sessionID = session.id

        pendingWork[sessionID]?.cancel()

        let provider = settingsProvider
        pendingWork[sessionID] = Task { [weak self] in
            if effectiveDelay > 0 {
                try? await Task.sleep(for: .seconds(effectiveDelay))
            }
            guard !Task.isCancelled else { return }

            let textHash = await MainActor.run { session.recentScrollbackText().hashValue }
            let lastHash = await MainActor.run { self?.lastContentHashes[sessionID] }
            if let lastHash, lastHash == textHash {
                Self.logger.debug("Skipping summarization — content unchanged for session \(sessionID)")
                return
            }

            let settings = await MainActor.run { provider.currentSettings() }

            if let summary = await SessionSummarizer.summarize(session: session, settings: settings) {
                await MainActor.run {
                    self?.lastContentHashes[sessionID] = textHash
                    session.summary = summary
                }
            }
        }
    }

    private func periodicRefresh() {
        guard let manager = sessionManager,
              let selectedID = manager.selectedSessionID,
              let session = manager.sessions.first(where: { $0.id == selectedID }),
              session.state == .running else {
            return
        }

        scheduleSummarization(for: session)
    }
}

// MARK: - TerminalSessionManager summarization wiring

extension TerminalSessionManager {

    private static let coordinatorKey: StaticString = "com.agentictoolkit.summarizationCoordinator"

    /// Default layout used when creating new sessions. Hosts can override per-session
    /// after creation if they need a different layout.
    public var defaultLayout: SessionLayoutState {
        get { _defaultLayoutStorage[ObjectIdentifier(self)] ?? SessionLayoutState() }
        set { _defaultLayoutStorage[ObjectIdentifier(self)] = newValue }
    }

    /// The current summarization coordinator, if enabled.
    public var summarizationCoordinator: SummarizationCoordinator? {
        _coordinatorStorage[ObjectIdentifier(self)]
    }

    /// Enables AI summarization for all sessions managed by this manager. Idempotent —
    /// a second call replaces the existing coordinator.
    public func enableSummarization(settingsProvider: SummarizationSettingsProviding) {
        let coordinator = SummarizationCoordinator(sessionManager: self, settingsProvider: settingsProvider)
        _coordinatorStorage[ObjectIdentifier(self)] = coordinator
    }

    /// Requests immediate summarization for a specific session (no debounce).
    public func requestSummarization(for session: TerminalSession) {
        summarizationCoordinator?.summarizeNow(session: session)
    }
}

// Associated-storage backing for the extension properties above. Keyed by ObjectIdentifier
// of the manager since stored properties can't be added in an extension.
@MainActor private var _defaultLayoutStorage: [ObjectIdentifier: SessionLayoutState] = [:]
@MainActor private var _coordinatorStorage: [ObjectIdentifier: SummarizationCoordinator] = [:]

extension SummarizationCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}

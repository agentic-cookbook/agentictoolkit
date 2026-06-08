import XCTest
import AgenticToolkitCore
import AgenticToolkitCoreMacOS
@testable import AgenticToolkitMacOS

/// A `SessionListSource` test double: returns canned sessions and lets the test
/// fire the change signal on demand — so the view model can be exercised with no
/// SQLite, no daemon, and no NotificationCenter.
private final class FakeSessionListSource: SessionWatcher.SessionListSource {
    var sessions: [SessionWatcher.SessionWatcherSession]
    private(set) var isObserving = false
    private var onChange: (@Sendable () -> Void)?

    init(_ sessions: [SessionWatcher.SessionWatcherSession]) {
        self.sessions = sessions
    }

    func fetchSessions() throws -> [SessionWatcher.SessionWatcherSession] {
        sessions
    }

    func startObserving(onChange: @escaping @Sendable () -> Void) {
        isObserving = true
        self.onChange = onChange
    }

    func stopObserving() {
        isObserving = false
        onChange = nil
    }

    /// Simulate the backing store changing.
    func fireChange() {
        onChange?()
    }
}

@MainActor
final class SessionListViewModelTests: XCTestCase {

    private func makeSession(
        _ identifier: String,
        term: String,
        cwd: String,
        status: SessionWatcher.SessionWatcherStatus = .active
    ) -> SessionWatcher.SessionWatcherSession {
        SessionWatcher.SessionWatcherSession(
            sessionId: identifier,
            cwd: cwd,
            status: status,
            termProgram: term
        )
    }

    private func makeViewModel(
        _ source: FakeSessionListSource
    ) -> SessionWatcher.SessionListViewModel {
        SessionWatcher.SessionListViewModel(source: source, settingsStore: UserSettings.shared)
    }

    func testGroupsLiveSessionsByTerminalApp() {
        let source = FakeSessionListSource([
            makeSession("alpha", term: "iTerm.app", cwd: "/Users/me/projA"),
            makeSession("bravo", term: "WarpTerminal", cwd: "/Users/me/projB")
        ])

        let viewModel = makeViewModel(source)

        XCTAssertEqual(viewModel.groups.count, 2)
        XCTAssertEqual(viewModel.sessionCount, 2)
        XCTAssertEqual(viewModel.activeSessionCount, 2)
        // Groups are sorted alphabetically (case-insensitive) by terminal app name.
        XCTAssertEqual(viewModel.groups.map(\.termProgram), ["iTerm.app", "WarpTerminal"])
    }

    func testExcludesEndedEmptyAndRootCwdSessions() {
        let source = FakeSessionListSource([
            makeSession("live", term: "iTerm.app", cwd: "/Users/me/projA", status: .active),
            makeSession("ended", term: "iTerm.app", cwd: "/Users/me/projB", status: .ended),
            makeSession("root", term: "iTerm.app", cwd: "/", status: .active),
            makeSession("empty", term: "iTerm.app", cwd: "", status: .active)
        ])

        let viewModel = makeViewModel(source)

        XCTAssertEqual(viewModel.sessionCount, 1)
    }

    func testSubscribesToSourceAndReloadsOnChange() {
        let source = FakeSessionListSource([])
        let viewModel = makeViewModel(source)

        XCTAssertTrue(source.isObserving, "view model should subscribe to the source")
        XCTAssertEqual(viewModel.sessionCount, 0)

        source.sessions = [makeSession("alpha", term: "iTerm.app", cwd: "/Users/me/projA")]
        source.fireChange()

        XCTAssertEqual(viewModel.sessionCount, 1, "change signal should trigger a reload")
    }

    func testStopListeningUnsubscribesFromSource() {
        let source = FakeSessionListSource([])
        let viewModel = makeViewModel(source)
        XCTAssertTrue(source.isObserving)

        viewModel.stopListening()

        XCTAssertFalse(source.isObserving)
    }
}

import XCTest
import Combine
import AgenticToolkitCore
import AgenticToolkitCoreMacOS
@testable import AgenticToolkitMacOS

/// A `SessionListSource` test double: returns canned sessions and lets the test
/// fire the change signal on demand — so the view model can be exercised with no
/// SQLite, no daemon, and no NotificationCenter.
private final class FakeSessionListSource: SessionWatcher.SessionListSource, @unchecked Sendable {
    var sessions: [SessionWatcher.SessionWatcherSession]
    private(set) var isObserving = false
    private var onChange: (@Sendable () -> Void)?

    init(_ sessions: [SessionWatcher.SessionWatcherSession]) {
        self.sessions = sessions
    }

    func fetchSessions() async throws -> [SessionWatcher.SessionWatcherSession] {
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

    /// The view model under test, tracked so tearDown can stop its timers/observer.
    private var viewModel: SessionWatcher.SessionListViewModel?

    override func tearDown() async throws {
        // Explicit teardown: the view model's init starts two repeating timers and a
        // notification observer. stopListening() tears them down deterministically
        // instead of relying on `deinit` firing promptly when the local goes out of
        // scope (which only holds while the test bodies never spin the run loop).
        viewModel?.stopListening()
        viewModel = nil
        try await super.tearDown()
    }

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
        let viewModel = SessionWatcher.SessionListViewModel(source: source, settingsStore: UserSettings.shared)
        self.viewModel = viewModel
        return viewModel
    }

    func testGroupsLiveSessionsByTerminalApp() async {
        let source = FakeSessionListSource([
            makeSession("alpha", term: "iTerm.app", cwd: "/Users/me/projA"),
            makeSession("bravo", term: "WarpTerminal", cwd: "/Users/me/projB")
        ])

        let viewModel = makeViewModel(source)
        await viewModel.reloadSessions()

        XCTAssertEqual(viewModel.groups.count, 2)
        XCTAssertEqual(viewModel.sessionCount, 2)
        XCTAssertEqual(viewModel.activeSessionCount, 2)
        // Groups are sorted alphabetically (case-insensitive) by terminal app name.
        XCTAssertEqual(viewModel.groups.map(\.termProgram), ["iTerm.app", "WarpTerminal"])
    }

    func testExcludesEndedEmptyAndRootCwdSessions() async {
        let source = FakeSessionListSource([
            makeSession("live", term: "iTerm.app", cwd: "/Users/me/projA", status: .active),
            makeSession("ended", term: "iTerm.app", cwd: "/Users/me/projB", status: .ended),
            makeSession("root", term: "iTerm.app", cwd: "/", status: .active),
            makeSession("empty", term: "iTerm.app", cwd: "", status: .active)
        ])

        let viewModel = makeViewModel(source)
        await viewModel.reloadSessions()

        XCTAssertEqual(viewModel.sessionCount, 1)
    }

    func testSubscribesToSourceAndReloadsOnChange() async {
        let source = FakeSessionListSource([])
        let viewModel = makeViewModel(source)

        XCTAssertTrue(source.isObserving, "view model should subscribe to the source")
        await viewModel.reloadSessions()
        XCTAssertEqual(viewModel.sessionCount, 0)

        // The change signal triggers an async reload; wait for the republished count.
        source.sessions = [makeSession("alpha", term: "iTerm.app", cwd: "/Users/me/projA")]
        let reloaded = expectation(description: "reload after change signal")
        let token = viewModel.$sessionCount
            .dropFirst()
            .sink { if $0 == 1 { reloaded.fulfill() } }
        source.fireChange()
        await fulfillment(of: [reloaded], timeout: 2)
        token.cancel()

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

import Testing
import Foundation
import CoreGraphics
import AgenticToolkitCore

@Suite("SystemWindowMatcher")
struct SystemWindowMatcherTests {

    // Window and fingerprint defaults use DIFFERENT displays so the +10 same-display
    // bonus is opt-in: a test only sees it when it passes matching `display:` values.
    private func makeWindow(
        id: UInt32 = 1, app: String, title: String, display: UInt32 = 99
    ) -> SystemWindowInfo {
        SystemWindowInfo(
            id: id, app: app, pid: 1, title: title,
            frame: .zero, display: display, isOnScreen: true, layer: 0
        )
    }

    private func makeFingerprint(
        app: String, pattern: String, strategy: MatchStrategy, display: UInt32 = 0
    ) -> SystemWindowFingerprint {
        SystemWindowFingerprint(
            app: app, titlePattern: pattern, matchStrategy: strategy, display: display
        )
    }

    private func makeSnapshot(app: String, fingerprint: SystemWindowFingerprint) -> SystemWindowSnapshot {
        SystemWindowSnapshot(
            windowID: nil, fingerprint: fingerprint, savedFrame: .zero,
            display: 0, app: app, title: ""
        )
    }

    @Test("app-name mismatch scores 0")
    func appMismatch() {
        let matcher = SystemWindowMatcher()
        let fingerprint = makeFingerprint(app: "Xcode", pattern: "Proj", strategy: .appAndTitleSubstring)
        #expect(matcher.score(window: makeWindow(app: "Other", title: "Proj"), against: fingerprint) == 0)
    }

    @Test("appOnly matches any same-app window")
    func appOnly() {
        let matcher = SystemWindowMatcher()
        let fingerprint = makeFingerprint(app: "Terminal", pattern: "", strategy: .appOnly)
        #expect(matcher.score(window: makeWindow(app: "Terminal", title: "anything"), against: fingerprint) == 80)
    }

    @Test("a one-character substring pattern does not over-match")
    func shortSubstringGuarded() {
        let matcher = SystemWindowMatcher()
        let fingerprint = makeFingerprint(app: "TestApp", pattern: "a", strategy: .appAndTitleSubstring)
        // Below the minimum substring length and not an exact match -> no match.
        #expect(matcher.score(window: makeWindow(app: "TestApp", title: "banana"), against: fingerprint) == 0)
    }

    @Test("a multi-character substring matches at 60")
    func substringMatches() {
        let matcher = SystemWindowMatcher()
        let fingerprint = makeFingerprint(app: "TestApp", pattern: "ban", strategy: .appAndTitleSubstring)
        #expect(matcher.score(window: makeWindow(app: "TestApp", title: "banana"), against: fingerprint) == 60)
    }

    @Test("regex strategy matches a whole title family")
    func regexFamily() {
        let matcher = SystemWindowMatcher()
        let fingerprint = makeFingerprint(app: "TestApp", pattern: "JIRA-\\d+", strategy: .appAndTitleRegex)
        let hit = makeWindow(app: "TestApp", title: "JIRA-1234 details")
        let miss = makeWindow(app: "TestApp", title: "no ticket")
        #expect(matcher.score(window: hit, against: fingerprint) == 80)
        #expect(matcher.score(window: miss, against: fingerprint) == 0)
    }

    @Test("display match adds a bonus")
    func displayBonus() {
        let matcher = SystemWindowMatcher()
        let fingerprint = makeFingerprint(app: "Terminal", pattern: "", strategy: .appOnly, display: 7)
        let window = makeWindow(app: "Terminal", title: "x", display: 7)
        #expect(matcher.score(window: window, against: fingerprint) == 90)
    }

    @Test("sub-threshold matches stay reported, not silently consumed")
    func subThresholdReported() {
        let matcher = SystemWindowMatcher()
        let fingerprint = makeFingerprint(app: "TestApp", pattern: "ban", strategy: .appAndTitleSubstring)
        let context = SystemWindowContext(
            name: "C", windowSnapshots: [makeSnapshot(app: "TestApp", fingerprint: fingerprint)]
        )
        let live = makeWindow(id: 5, app: "TestApp", title: "banana") // scores 60

        // Default threshold (80): the 60-pt pair must not be consumed; both remain reported.
        let result = matcher.matchWindows(contexts: [context], liveWindows: [live])
        #expect(result.matched.isEmpty)
        #expect(result.unmatchedSnapshots.count == 1)
        #expect(result.unassignedWindows.map(\.id) == [5])

        // A lower threshold accepts it.
        let lower = matcher.matchWindows(contexts: [context], liveWindows: [live], threshold: 60)
        #expect(lower.matched.count == 1)
    }

    @Test("greedy assignment is deterministic for tied scores")
    func deterministicTies() {
        let matcher = SystemWindowMatcher()
        let appOnly = makeFingerprint(app: "Terminal", pattern: "", strategy: .appOnly)
        let ctxA = SystemWindowContext(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000001")!,
            name: "A",
            windowSnapshots: [makeSnapshot(app: "Terminal", fingerprint: appOnly)]
        )
        let ctxB = SystemWindowContext(
            id: UUID(uuidString: "00000000-0000-0000-0000-000000000002")!,
            name: "B",
            windowSnapshots: [makeSnapshot(app: "Terminal", fingerprint: appOnly)]
        )
        let windows = [
            makeWindow(id: 10, app: "Terminal", title: "t1"),
            makeWindow(id: 20, app: "Terminal", title: "t2")
        ]

        let first = matcher.matchWindows(contexts: [ctxA, ctxB], liveWindows: windows)
        let second = matcher.matchWindows(contexts: [ctxA, ctxB], liveWindows: windows)
        #expect(first == second)
        #expect(first.matched.count == 2)
    }

    @Test("MatchResult equality distinguishes different unmatched snapshots")
    func matchResultEquality() {
        let snapA = (contextID: UUID(), snapshotID: UUID())
        let snapB = (contextID: UUID(), snapshotID: UUID())
        let lhs = SystemWindowMatcher.MatchResult(matched: [], unmatchedSnapshots: [snapA], unassignedWindows: [])
        let rhs = SystemWindowMatcher.MatchResult(matched: [], unmatchedSnapshots: [snapB], unassignedWindows: [])
        #expect(lhs != rhs)
        #expect(lhs == lhs)
    }
}

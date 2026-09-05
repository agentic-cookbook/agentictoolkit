import Foundation
import Testing
@testable import AgenticToolkitMacOS

/// The trail behind the settings toolbar's `‹ ›` control. The cases worth
/// pinning are the ones where a naive stack misbehaves: stepping back must not
/// itself be recorded, re-picking the current panel must not stack up entries
/// that go nowhere, and a new step after going back must drop the forward trail.
@Suite("SettingsNavigationHistory")
struct SettingsNavigationHistoryTests {

    @Test("a fresh history can go nowhere")
    func emptyHistoryIsInert() {
        var history = ComposableSettings.SettingsNavigationHistory()
        #expect(history.current == nil)
        #expect(!history.canGoBack)
        #expect(!history.canGoForward)
        #expect(history.goBack() == nil)
        #expect(history.goForward() == nil)
    }

    @Test("one visit is somewhere, but not somewhere to go back from")
    func singleVisit() {
        var history = ComposableSettings.SettingsNavigationHistory()
        history.record(3)
        #expect(history.current == 3)
        #expect(!history.canGoBack)
        #expect(!history.canGoForward)
    }

    @Test("back and forward walk the recorded trail")
    func backAndForwardWalkTheTrail() {
        var history = ComposableSettings.SettingsNavigationHistory()
        history.record(0)
        history.record(1)
        history.record(2)

        #expect(history.goBack() == 1)
        #expect(history.goBack() == 0)
        #expect(!history.canGoBack)
        #expect(history.canGoForward)
        #expect(history.goForward() == 1)
        #expect(history.goForward() == 2)
        #expect(!history.canGoForward)
    }

    @Test("re-selecting the panel already shown is not a step")
    func repeatedSelectionIsNotAStep() {
        var history = ComposableSettings.SettingsNavigationHistory()
        history.record(0)
        history.record(1)
        history.record(1)
        history.record(1)

        #expect(history.goBack() == 0)
        #expect(!history.canGoBack)
    }

    @Test("a new step after going back discards the forward trail")
    func recordingAfterGoingBackTruncates() {
        var history = ComposableSettings.SettingsNavigationHistory()
        history.record(0)
        history.record(1)
        history.record(2)
        _ = history.goBack()

        history.record(5)

        #expect(history.current == 5)
        #expect(!history.canGoForward)
        #expect(history.goBack() == 1)
    }

    @Test("reset forgets the trail, since the indices stop meaning anything")
    func resetForgetsEverything() {
        var history = ComposableSettings.SettingsNavigationHistory()
        history.record(0)
        history.record(1)

        history.reset()

        #expect(history.current == nil)
        #expect(!history.canGoBack)
        #expect(!history.canGoForward)
    }
}

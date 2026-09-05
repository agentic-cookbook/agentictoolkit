import AppKit
import Foundation
import Testing

import AgenticToolkitCore
@testable import AgenticToolkitMacOS

/// The sidebar's filter. Two things matter beyond "does it find the word":
/// a panel must be findable *before* it is ever opened, and looking for it
/// must not open it — harvesting used to force every panel's view to load on
/// the first keystroke, running each one's side effects for a reader who had
/// typed a single letter.
@Suite("SettingsSearchIndex")
@MainActor
struct SettingsSearchIndexTests {

    /// A panel whose keywords and help are supplied per test, so a match can be
    /// attributed to exactly one source of text.
    private final class TestPanel: ComposableSettings.SettingsPanelViewController {

        private let keywords: [String]
        private let help: ComposableSettings.PanelHelp?

        init(
            title: String,
            section: String? = nil,
            keywords: [String] = [],
            help: ComposableSettings.PanelHelp? = nil
        ) {
            self.keywords = keywords
            self.help = help
            super.init(with: .init(title: title, section: section))
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        override var searchKeywords: [String] { keywords }

        override var helpContent: ComposableSettings.PanelHelp? { help }
    }

    private let index = ComposableSettings.SettingsSearchIndex()

    @Test("a blank query keeps every panel, so clearing the field restores the list")
    func blankQueryMatchesEverything() {
        let panel = TestPanel(title: "General")
        #expect(index.matches(panel, query: ""))
        #expect(index.matches(panel, query: "   "))
    }

    @Test("the title matches, case-insensitively")
    func titleMatches() {
        let panel = TestPanel(title: "Terminal")
        #expect(index.matches(panel, query: "TERM"))
        #expect(!index.matches(panel, query: "keyboard"))
    }

    @Test("the section matches, so a panel is found by the group it sits in")
    func sectionMatches() {
        let panel = TestPanel(title: "Fonts", section: "Appearance")
        #expect(index.matches(panel, query: "appearance"))
    }

    @Test("declared keywords match a panel that has never been opened")
    func keywordsMatchWithoutLoading() {
        let panel = TestPanel(title: "Servers", keywords: ["model context protocol", "stdio"])
        #expect(index.matches(panel, query: "stdio"))
        #expect(panel.isViewLoaded == false, "searching must not build the panel")
    }

    @Test("help prose matches — both a topic's title and its body")
    func helpMatches() {
        let panel = TestPanel(
            title: "General",
            help: .init(topics: [
                .init(title: "Login Items", body: "Start the app when you log in.")
            ]))
        #expect(index.matches(panel, query: "login items"))
        #expect(index.matches(panel, query: "log in"))
    }

    @Test("every word must appear, so a second word narrows rather than widens")
    func allWordsMustMatch() {
        let panel = TestPanel(title: "Terminal", keywords: ["font"])
        #expect(index.matches(panel, query: "terminal font"))
        #expect(!index.matches(panel, query: "terminal keyboard"))
    }

    @Test("an opened panel is matched by the labels its own controls carry")
    func labelsOfALoadedPanelMatch() {
        let panel = TestPanel(title: "General")
        panel.loadViewIfNeeded()
        let group = ComposableSettings.GroupView(withTitle: "Startup")
        group.addSettingSubview(ComposableSettings.makeRowLabel("Launch at login"))
        panel.addGroup(group)

        #expect(index.matches(panel, query: "launch at login"))
        #expect(!index.matches(panel, query: "cursor blink"))
    }

    @Test("an unopened panel is not matched by text it has not declared")
    func unloadedPanelIsNotSearchedByItsControls() {
        let panel = TestPanel(title: "General", keywords: ["startup"])

        #expect(!index.matches(panel, query: "launch at login"))
        #expect(panel.isViewLoaded == false, "a miss must not build the panel either")
    }
}

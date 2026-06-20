import Testing
import AppKit
@testable import AIPluginKit
@testable import AgenticToolkitMacOS

@Suite("PluginLoadFailuresPanel")
@MainActor
struct PluginLoadFailuresPanelTests {

    @Test("summaryTitle pluralizes")
    func summaryPluralizes() {
        let one = [PluginLoadFailure(identifier: "a", displayName: "A", message: "boom")]
        let two = one + [PluginLoadFailure(identifier: "b", displayName: "B", message: "bang")]

        #expect(PluginLoadFailuresPanel.summaryTitle(for: one) == "1 plugin failed to load")
        #expect(PluginLoadFailuresPanel.summaryTitle(for: two) == "2 plugins failed to load")
    }

    @Test("panel builds without crashing")
    func panelBuilds() {
        let failures = [
            PluginLoadFailure(identifier: "a", displayName: "A", message: "boom"),
            PluginLoadFailure(identifier: "b", displayName: "B", message: "bang")
        ]

        let panel = PluginLoadFailuresPanel(failures: failures)
        _ = panel.view  // triggers loadView + viewDidLoad, building the group

        #expect(panel.descriptor.title == "2 plugins failed to load")
    }
}

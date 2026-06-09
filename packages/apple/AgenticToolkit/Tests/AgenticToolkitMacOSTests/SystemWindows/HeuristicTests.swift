import Testing
import Foundation
import AgenticToolkitCore

@Suite("Heuristics")
struct HeuristicTests {

    @Test("Xcode extracts the project before the em dash")
    func xcode() {
        #expect(XcodeHeuristic().extractPattern(from: "MyApp \u{2014} ContentView.swift") == "MyApp")
    }

    @Test("Xcode also handles the en-dash separator variant")
    func xcodeEnDash() {
        #expect(XcodeHeuristic().extractPattern(from: "MyApp \u{2013} ContentView.swift") == "MyApp")
    }

    @Test("VSCode extracts the workspace name")
    func vscode() {
        #expect(VSCodeHeuristic().extractPattern(from: "temporal \u{2014} api.go") == "temporal")
    }

    @Test("Warp extracts the last path component")
    func warpPath() {
        #expect(WarpHeuristic().extractPattern(from: "mike - ~/projects/myapp (develop)") == "myapp")
    }

    @Test("Warp root directory yields no pattern (not a literal slash)")
    func warpRoot() {
        #expect(WarpHeuristic().extractPattern(from: "user - / (main)") == nil)
    }

    @Test("a regex custom heuristic fingerprints by the pattern, not the captured value")
    func regexFingerprint() {
        let rule = CustomHeuristicRule(appName: "Jira", titlePattern: "JIRA-\\d+", matchMode: .regex)
        let heuristic = CustomHeuristic(rule: rule)

        let fingerprint = heuristic.fingerprintPattern(for: "JIRA-1234 \u{2014} details")
        #expect(fingerprint?.pattern == "JIRA-\\d+")
        #expect(fingerprint?.strategy == .appAndTitleRegex)

        // A title the rule doesn't match produces no fingerprint.
        #expect(heuristic.fingerprintPattern(for: "no ticket here") == nil)
    }

    @Test("a substring custom heuristic fingerprints by the substring with the substring strategy")
    func substringFingerprint() {
        let rule = CustomHeuristicRule(appName: "Notes", titlePattern: "Daily", matchMode: .substring)
        let heuristic = CustomHeuristic(rule: rule)
        let fingerprint = heuristic.fingerprintPattern(for: "Daily Standup")
        #expect(fingerprint?.pattern == "Daily")
        #expect(fingerprint?.strategy == .appAndTitleSubstring)
    }

    @Test("registry treats a custom override of a built-in app as user-defined")
    func isBuiltInOverride() {
        let registry = HeuristicRegistry()
        #expect(registry.isBuiltIn(appName: "Xcode"))

        registry.registerCustomRules([
            CustomHeuristicRule(appName: "Xcode", titlePattern: "X", matchMode: .substring)
        ])
        #expect(!registry.isBuiltIn(appName: "Xcode"))
    }
}

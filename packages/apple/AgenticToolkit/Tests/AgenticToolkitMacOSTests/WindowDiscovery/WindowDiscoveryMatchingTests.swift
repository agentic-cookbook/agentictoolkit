import Testing
import Foundation
import CoreGraphics
import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("WindowDiscovery matching")
struct WindowDiscoveryMatchingTests {

    private func makeWindow(app: String, title: String) -> SystemWindowInfo {
        SystemWindowInfo(
            id: 1,
            app: app,
            pid: 1,
            title: title,
            frame: .zero,
            display: 0,
            isOnScreen: true,
            layer: 0
        )
    }

    @Test("Xcode title matches the project via the heuristic, not just a raw substring")
    func xcodeHeuristicMatch() {
        let window = makeWindow(app: "Xcode", title: "MyApp — ContentView.swift")
        #expect(WindowDiscoveryViewModel.matches(window: window, projectName: "MyApp"))
    }

    @Test("raw-title substring still matches when no heuristic applies")
    func rawTitleFallback() {
        let window = makeWindow(app: "SomeEditor", title: "Working on MyApp now")
        #expect(WindowDiscoveryViewModel.matches(window: window, projectName: "MyApp"))
    }

    @Test("a different project does not match")
    func nonMatch() {
        let window = makeWindow(app: "Xcode", title: "OtherProject — File.swift")
        #expect(!WindowDiscoveryViewModel.matches(window: window, projectName: "MyApp"))
    }

    @Test("empty or Unknown project never matches")
    func emptyOrUnknown() {
        let window = makeWindow(app: "Xcode", title: "MyApp — File.swift")
        #expect(!WindowDiscoveryViewModel.matches(window: window, projectName: ""))
        #expect(!WindowDiscoveryViewModel.matches(window: window, projectName: "Unknown"))
    }
}

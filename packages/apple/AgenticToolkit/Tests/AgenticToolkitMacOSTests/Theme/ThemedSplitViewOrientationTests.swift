import XCTest
import AppKit
import AgenticToolkitMacOS

/// `ThemedSplitViewController` replaces the split view `NSSplitViewController`
/// would have made, so anything it changes beyond the divider colour changes
/// every window built on it.
///
/// A bare `NSSplitView` is stacked and the one `NSSplitViewController` vends is
/// side by side, which is how the settings window lost its sidebar: the panel
/// list became a header above the panel.
@MainActor
final class ThemedSplitViewOrientationTests: XCTestCase {

    func testAThemedSplitViewIsSideBySideLikeTheOneItReplaces() {
        let stock = NSSplitViewController()
        _ = stock.view
        let themed = ThemedSplitViewController()
        _ = themed.view

        XCTAssertTrue(stock.splitView.isVertical, "assumption: AppKit vends a side-by-side split view")
        XCTAssertEqual(themed.splitView.isVertical, stock.splitView.isVertical)
    }

    func testTheSettingsWindowKeepsItsPanelListBesideThePanel() {
        let controller = ComposableSettings.SplitViewController()
        _ = controller.view

        XCTAssertTrue(controller.splitView.isVertical)
    }

    /// The terminal pane never set an orientation either, so its session list
    /// went from a sidebar to a strip across the top.
    func testTheTerminalSessionListSitsBesideTheTerminal() {
        let controller = TerminalSessionSplitViewController(sessionManager: TerminalSessionManager())
        _ = controller.view

        XCTAssertTrue(controller.splitView.isVertical)
        controller.paneContentWillBeDiscarded()
    }
}

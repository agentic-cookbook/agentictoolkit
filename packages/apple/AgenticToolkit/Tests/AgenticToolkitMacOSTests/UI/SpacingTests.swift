import XCTest
@testable import AgenticToolkitMacOS

/// The whole point of the four-arrow cluster is that the same arrow means
/// different things at different corners — "down" at the top edge is more top
/// inset, and at the bottom edge it is less bottom inset. Getting that wrong
/// looks like the control moving the wrong edge, so it is pinned here.
final class SpacingEditRulesTests: XCTestCase {

    private let range = 0...80

    func testAnArrowAtACornerMovesThatCornerNotAFixedEdge() {
        let start = Spacing(uniform: 10)

        XCTAssertEqual(start.moving(.topLeading, .down, in: range).top, 11, "down at the top is more top inset")
        XCTAssertEqual(start.moving(.topLeading, .up, in: range).top, 9, "up at the top is less top inset")
        XCTAssertEqual(start.moving(.bottomLeading, .down, in: range).bottom, 9, "down at the bottom is less")
        XCTAssertEqual(start.moving(.bottomLeading, .up, in: range).bottom, 11, "up at the bottom is more")

        XCTAssertEqual(start.moving(.topLeading, .right, in: range).leading, 11)
        XCTAssertEqual(start.moving(.topLeading, .left, in: range).leading, 9)
        XCTAssertEqual(start.moving(.topTrailing, .right, in: range).trailing, 9)
        XCTAssertEqual(start.moving(.topTrailing, .left, in: range).trailing, 11)
    }

    func testAnArrowLeavesEveryOtherEdgeAlone() {
        let moved = Spacing(uniform: 10).moving(.bottomTrailing, .right, in: range)

        XCTAssertEqual(moved.trailing, 9)
        XCTAssertEqual(moved.top, 10)
        XCTAssertEqual(moved.leading, 10)
        XCTAssertEqual(moved.bottom, 10)
    }

    func testAnArrowStopsAtTheEndsOfTheRange() {
        let atFloor = Spacing(top: 0)
        XCTAssertEqual(atFloor.moving(.topLeading, .up, in: range).top, 0, "no negative padding")

        let atCeiling = Spacing(top: 80)
        XCTAssertEqual(atCeiling.moving(.topLeading, .down, in: range).top, 80)
    }

    func testAGutterOpensAndClosesByTheWholeGapNotHalfOfIt() {
        let start = Spacing(betweenColumns: 10, betweenRows: 4)

        XCTAssertEqual(start.adjusting(.betweenColumns, by: 1, in: range).betweenColumns, 11)
        XCTAssertEqual(start.adjusting(.betweenColumns, by: -1, in: range).betweenColumns, 9)
        XCTAssertEqual(start.adjusting(.betweenColumns, by: 1, in: range).betweenRows, 4, "one gutter at a time")
        XCTAssertEqual(start.adjusting(.betweenRows, by: -10, in: range).betweenRows, 0, "clamped, not negative")
    }

    func testATypedNumberIsClampedRatherThanRefused() {
        let start = Spacing()

        XCTAssertEqual(start.setting(.top, to: 500, in: range).top, 80)
        XCTAssertEqual(start.setting(.top, to: -20, in: range).top, 0)
        XCTAssertEqual(start.setting(.betweenColumns, to: 500, in: range).betweenColumns, 80)
    }
}

/// The diagram is the control, so its geometry is behaviour: a cluster that
/// does not ride its corner, or two gutter controls drawn on top of each other,
/// are bugs a compile cannot catch.
final class SpacingControlLayoutTests: XCTestCase {

    private let diagram = CGRect(x: 44 + 26, y: 21 + 26, width: 240, height: 150)

    private func layout(_ spacing: Spacing, panes: Bool = true) -> SpacingControlLayout {
        SpacingControlLayout(diagram: diagram, spacing: spacing, showsGutters: panes)
    }

    func testWithNoInsetsTheContentFillsTheFrame() {
        XCTAssertEqual(layout(Spacing()).content, diagram)
    }

    func testEachInsetTakesFromItsOwnEdge() {
        let content = layout(Spacing(top: 10, leading: 20)).content

        XCTAssertEqual(content.minX, diagram.minX + SpacingControlLayout.displayed(20))
        XCTAssertEqual(content.maxX, diagram.maxX, "trailing was not set")
        XCTAssertEqual(content.maxY, diagram.maxY - SpacingControlLayout.displayed(10))
        XCTAssertEqual(content.minY, diagram.minY, "bottom was not set")
    }

    func testAClusterRidesTheCornerItMoves() {
        let plan = layout(Spacing(top: 10, leading: 20, bottom: 30, trailing: 40))

        XCTAssertEqual(plan.position(of: .topLeading), CGPoint(x: plan.content.minX, y: plan.content.maxY))
        XCTAssertEqual(plan.position(of: .bottomTrailing), CGPoint(x: plan.content.maxX, y: plan.content.minY))
    }

    func testMoreInsetMovesTheClusterInward() {
        let none = layout(Spacing()).position(of: .topLeading)
        let some = layout(Spacing(top: 10, leading: 10)).position(of: .topLeading)

        XCTAssertGreaterThan(some.x, none.x, "the left edge moved right")
        XCTAssertLessThan(some.y, none.y, "the top edge moved down")
    }

    func testASingleViewHasOnePaneAndNoGutters() {
        let plan = layout(Spacing(uniform: 10), panes: false)

        XCTAssertEqual(plan.panes.count, 1)
        XCTAssertEqual(plan.panes[0], plan.content)
        XCTAssertEqual(plan.columnGutter, .zero)
    }

    func testPanesAreTheFourQuadrantsLeftByTheGutters() {
        let plan = layout(Spacing(betweenColumns: 10, betweenRows: 10))

        XCTAssertEqual(plan.panes.count, 4)
        for pane in plan.panes {
            XCTAssertGreaterThan(pane.width, 0)
            XCTAssertGreaterThan(pane.height, 0)
            XCTAssertFalse(pane.intersects(plan.columnGutter), "a pane never overlaps the gap beside it")
            XCTAssertFalse(pane.intersects(plan.rowGutter))
        }
    }

    func testAZeroGutterStillDrawsAsAHairlineSoTheDiagramReadsAsPanes() {
        let plan = layout(Spacing())

        XCTAssertGreaterThan(plan.columnGutter.width, 0)
        XCTAssertGreaterThan(plan.rowGutter.height, 0)
    }

    /// The two gutter controls sit on gutters that cross, so the only thing
    /// keeping them apart is where along each gutter they are put. Checked at
    /// both ends of the inset range, because the content rect — and so the
    /// distance between them — is smallest when the insets are largest.
    func testTheTwoGutterControlsNeverOverlap() {
        for inset in [0, 40, 80] {
            let plan = layout(Spacing(uniform: inset))
            let columns = box(around: plan.position(of: .betweenColumns), stacked: true)
            let rows = box(around: plan.position(of: .betweenRows), stacked: false)

            XCTAssertFalse(columns.intersects(rows), "gutter controls overlap at inset \(inset)")
        }
    }

    /// The control's own metrics: a 44 × 21 field, and an 18-point button
    /// offset past it.
    private func box(around centre: CGPoint, stacked: Bool) -> CGRect {
        let reach = stacked
            ? CGSize(width: 44 / 2, height: 21 / 2 + 18 + 2)
            : CGSize(width: 44 / 2 + 18 + 2, height: 21 / 2)
        return CGRect(
            x: centre.x - reach.width,
            y: centre.y - reach.height,
            width: reach.width * 2,
            height: reach.height * 2
        )
    }
}

import XCTest
@testable import AgenticToolkitMacOS

/// Each edge carries two arrows, and which number each one moves — and which
/// way — is the whole of the control's meaning. Getting it wrong looks like the
/// control moving the wrong edge, so it is pinned here.
final class SpacingEditRulesTests: XCTestCase {

    private let range = 0...80

    func testTheOutwardArrowAddsRoomAndTheInwardArrowTakesItAway() {
        let start = Spacing(uniform: 10)

        for edge in SpacingEdge.allCases {
            XCTAssertEqual(start.adjusting(edge, by: 1, in: range)[edge], 11, "\(edge) grows")
            XCTAssertEqual(start.adjusting(edge, by: -1, in: range)[edge], 9, "\(edge) shrinks")
        }
    }

    /// Which way each arrow points is derived from the edge, not looked up, so
    /// what is pinned is that the pair are opposites and that the growing one
    /// points out of the frame.
    func testEachEdgesArrowsPointOutOfAndIntoTheFrame() {
        XCTAssertEqual(SpacingEdge.top.outward, .up)
        XCTAssertEqual(SpacingEdge.bottom.outward, .down)
        XCTAssertEqual(SpacingEdge.leading.outward, .left)
        XCTAssertEqual(SpacingEdge.trailing.outward, .right)

        for edge in SpacingEdge.allCases {
            XCTAssertEqual(edge.inward, edge.outward.opposite, "\(edge)'s two arrows are opposites")
        }
    }

    func testAnArrowLeavesEveryOtherEdgeAlone() {
        let moved = Spacing(uniform: 10).adjusting(.trailing, by: -1, in: range)

        XCTAssertEqual(moved.trailing, 9)
        XCTAssertEqual(moved.top, 10)
        XCTAssertEqual(moved.leading, 10)
        XCTAssertEqual(moved.bottom, 10)
    }

    func testAnArrowStopsAtTheEndsOfTheRange() {
        XCTAssertEqual(Spacing(top: 0).adjusting(.top, by: -1, in: range).top, 0, "no negative padding")
        XCTAssertEqual(Spacing(top: 80).adjusting(.top, by: 1, in: range).top, 80)
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

/// The diagram is the control, so its geometry is behaviour: a number that does
/// not sit on the edge it edits, or two divider controls drawn on top of each
/// other, are bugs a compile cannot catch.
final class SpacingControlLayoutTests: XCTestCase {

    /// The two diagrams the control draws, at the sizes it draws them: the pane
    /// grid fills the control, and the frame is inset to leave room for the
    /// numbers straddling its edges.
    private let paneDiagram = CGRect(x: 0, y: 0, width: 300, height: 170)
    private let frameDiagram = CGRect(x: 22, y: 16, width: 256, height: 138)

    private func frame(_ spacing: Spacing) -> SpacingControlLayout {
        SpacingControlLayout(diagram: frameDiagram, spacing: spacing, style: .frame)
    }

    private func panes(_ spacing: Spacing) -> SpacingControlLayout {
        SpacingControlLayout(diagram: paneDiagram, spacing: spacing, style: .paneDividers)
    }

    func testWithNoInsetsTheContentFillsTheFrame() {
        XCTAssertEqual(frame(Spacing()).content, frameDiagram)
    }

    func testEachInsetTakesFromItsOwnEdge() {
        let content = frame(Spacing(top: 10, leading: 20)).content

        XCTAssertEqual(content.minX, frameDiagram.minX + SpacingControlLayout.displayed(20))
        XCTAssertEqual(content.maxX, frameDiagram.maxX, "trailing was not set")
        XCTAssertEqual(content.maxY, frameDiagram.maxY - SpacingControlLayout.displayed(10))
        XCTAssertEqual(content.minY, frameDiagram.minY, "bottom was not set")
    }

    func testEachNumberSitsOnTheMiddleOfTheEdgeItEdits() {
        let plan = frame(Spacing(top: 10, leading: 20, bottom: 30, trailing: 40))

        XCTAssertEqual(plan.position(of: .top), CGPoint(x: frameDiagram.midX, y: frameDiagram.maxY))
        XCTAssertEqual(plan.position(of: .bottom), CGPoint(x: frameDiagram.midX, y: frameDiagram.minY))
        XCTAssertEqual(plan.position(of: .leading), CGPoint(x: frameDiagram.minX, y: frameDiagram.midY))
        XCTAssertEqual(plan.position(of: .trailing), CGPoint(x: frameDiagram.maxX, y: frameDiagram.midY))
    }

    /// The reason the controls hang off the frame rather than off the content:
    /// an arrow held down would otherwise walk out from under the pointer.
    func testAnEdgesControlsDoNotMoveWhenItsNumberChanges() {
        for edge in SpacingEdge.allCases {
            XCTAssertEqual(
                frame(Spacing()).position(of: edge),
                frame(Spacing(uniform: 40)).position(of: edge),
                "\(edge)'s controls moved with its value"
            )
        }
    }

    func testTheFrameDiagramHasOnePaneAndNoDividers() {
        let plan = frame(Spacing(uniform: 10))

        XCTAssertEqual(plan.panes.count, 1)
        XCTAssertEqual(plan.panes[0], plan.content)
        XCTAssertEqual(plan.columnGutter, .zero)
    }

    /// The pane diagram's margin is fixed: the room around the grid is the
    /// frame control's number, and this diagram does not edit it.
    func testThePaneDiagramsMarginIgnoresTheInsets() {
        XCTAssertEqual(panes(Spacing()).content, panes(Spacing(uniform: 80)).content)
    }

    func testPanesAreTheFourQuadrantsLeftByTheDividers() {
        let plan = panes(Spacing(betweenColumns: 10, betweenRows: 10))

        XCTAssertEqual(plan.panes.count, 4)
        for pane in plan.panes {
            XCTAssertGreaterThan(pane.width, 0)
            XCTAssertGreaterThan(pane.height, 0)
            XCTAssertFalse(pane.intersects(plan.columnGutter), "a pane never overlaps the gap beside it")
            XCTAssertFalse(pane.intersects(plan.rowGutter))
        }
    }

    func testAZeroDividerStillDrawsAsAHairlineSoTheDiagramReadsAsPanes() {
        let plan = panes(Spacing())

        XCTAssertGreaterThan(plan.columnGutter.width, 0)
        XCTAssertGreaterThan(plan.rowGutter.height, 0)
    }

    /// Each divider's number is centred on the panes it separates — the column
    /// divider halfway down the top row, the row divider halfway across the
    /// left column.
    func testADividersNumberSitsInTheMiddleOfThePanesItSeparates() {
        let plan = panes(Spacing(betweenColumns: 10, betweenRows: 10))
        let topLeft = plan.panes[0]

        let columns = plan.position(of: .betweenColumns)
        XCTAssertEqual(columns.x, plan.columnGutter.midX)
        XCTAssertEqual(columns.y, topLeft.midY, accuracy: 0.001)

        let rows = plan.position(of: .betweenRows)
        XCTAssertEqual(rows.y, plan.rowGutter.midY)
        XCTAssertEqual(rows.x, topLeft.midX, accuracy: 0.001)
    }

    /// The two divider controls sit on gutters that cross, so the only thing
    /// keeping them apart is where along each gutter they are put. Checked
    /// across the range, because the panes — and so the distance between the
    /// two middles — change size with the gap.
    func testTheTwoDividerControlsNeverOverlap() {
        for gap in [0, 10, 40, 80] {
            let plan = panes(Spacing(betweenColumns: gap, betweenRows: gap))
            let columns = box(around: plan.position(of: .betweenColumns), stacked: true)
            let rows = box(around: plan.position(of: .betweenRows), stacked: false)

            XCTAssertFalse(columns.intersects(rows), "divider controls overlap at gap \(gap)")
        }
    }

    /// The control's own metrics: a 44 × 21 field, flanked along the divider by
    /// two buttons 18 points thick and 40 long, offset half a field plus half a
    /// button plus half the arrow gap.
    private func box(around centre: CGPoint, stacked: Bool) -> CGRect {
        let reach = stacked
            ? CGSize(width: 44 / 2, height: 21 / 2 + 18 / 2 + 3 + 18 / 2)
            : CGSize(width: 44 / 2 + 18 / 2 + 3 + 18 / 2, height: 40 / 2)
        return CGRect(
            x: centre.x - reach.width,
            y: centre.y - reach.height,
            width: reach.width * 2,
            height: reach.height * 2
        )
    }
}

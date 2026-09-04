import XCTest
@testable import AgenticToolkitMacOS

/// Each edge carries two arrows, and which number each one moves — and which
/// way — is the whole of the control's meaning. Getting it wrong looks like the
/// control moving the wrong edge, so it is pinned here.
final class SpacingEditRulesTests: XCTestCase {

    private let range = 0...80

    func testTheGrowingArrowAddsRoomAndTheShrinkingArrowTakesItAway() {
        let start = Spacing(uniform: 10)

        for edge in SpacingEdge.allCases {
            XCTAssertEqual(start.adjusting(edge, by: 1, in: range)[edge], 11, "\(edge) grows")
            XCTAssertEqual(start.adjusting(edge, by: -1, in: range)[edge], 9, "\(edge) shrinks")
        }
    }

    /// Every arrow points the way the line it stands against travels, and the
    /// line an inset moves is the *view's* edge — so adding room at the top
    /// sends the top edge **down**. This is the assertion that catches the
    /// tempting reading, "the arrow that adds room points out of the frame",
    /// which puts every arrow opposite the line it moves.
    func testEachEdgesArrowsPointTheWayThatEdgeTravels() {
        XCTAssertEqual(SpacingEdge.top.growing, .down)
        XCTAssertEqual(SpacingEdge.bottom.growing, .up)
        XCTAssertEqual(SpacingEdge.leading.growing, .right)
        XCTAssertEqual(SpacingEdge.trailing.growing, .left)

        for edge in SpacingEdge.allCases {
            XCTAssertEqual(edge.shrinking, edge.growing.opposite, "\(edge)'s two arrows are opposites")
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

    /// The rectangle **both** flavors draw their diagram in: one control size
    /// (380 × 220) less one inset (28 a side), so a panel showing a frame
    /// control above a divider control gets two pictures that line up.
    private let diagram = CGRect(x: 28, y: 28, width: 324, height: 164)

    private func frame(_ spacing: Spacing) -> SpacingControlLayout {
        SpacingControlLayout(diagram: diagram, spacing: spacing, style: .frame)
    }

    private func panes(_ spacing: Spacing) -> SpacingControlLayout {
        SpacingControlLayout(diagram: diagram, spacing: spacing, style: .paneDividers)
    }

    func testWithNoInsetsTheContentFillsTheFrame() {
        XCTAssertEqual(frame(Spacing()).content, diagram)
    }

    func testEachInsetTakesFromItsOwnEdge() {
        let content = frame(Spacing(top: 10, leading: 20)).content

        XCTAssertEqual(content.minX, diagram.minX + SpacingControlLayout.displayed(20))
        XCTAssertEqual(content.maxX, diagram.maxX, "trailing was not set")
        XCTAssertEqual(content.maxY, diagram.maxY - SpacingControlLayout.displayed(10))
        XCTAssertEqual(content.minY, diagram.minY, "bottom was not set")
    }

    /// A number straddles the line its arrows move — the **view's** edge, not
    /// the container's. The container stays where it is however much room is
    /// asked for, so an arrow attached to it would point at a line it never
    /// touches.
    func testEachNumberSitsOnTheMiddleOfTheEdgeOfTheViewItEdits() {
        let plan = frame(Spacing(top: 10, leading: 20, bottom: 30, trailing: 40))
        let content = plan.content

        XCTAssertEqual(plan.position(of: .top), CGPoint(x: content.midX, y: content.maxY))
        XCTAssertEqual(plan.position(of: .bottom), CGPoint(x: content.midX, y: content.minY))
        XCTAssertEqual(plan.position(of: .leading), CGPoint(x: content.minX, y: content.midY))
        XCTAssertEqual(plan.position(of: .trailing), CGPoint(x: content.maxX, y: content.midY))

        XCTAssertNotEqual(
            plan.position(of: .top), CGPoint(x: diagram.midX, y: diagram.maxY),
            "pinned to the container, an arrow would sit still while the line it points at moved"
        )
    }

    /// An arrow standing against the line it moves travels with that line, so
    /// the picture only works while that travel stays under half an arrow: past
    /// that, an arrow held down slides out from under the pointer and the
    /// repeat stops. That is why the *displayed* inset is capped far below the
    /// range the number itself covers.
    func testAHeldArrowCannotTravelOutFromUnderThePointer() {
        XCTAssertLessThan(
            SpacingControlLayout.maximumDisplayedInset,
            SpacingControl.arrowLength / 2,
            "an arrow can travel further than half its own length"
        )

        let travel = frame(Spacing()).position(of: .top).y
            - frame(Spacing(uniform: 80)).position(of: .top).y
        XCTAssertEqual(travel, SpacingControlLayout.maximumDisplayedInset)
        XCTAssertLessThan(travel, SpacingControl.arrowLength / 2)
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
    /// two middles — change size with the gap, and because each control is now
    /// four arrows wide rather than two.
    func testTheTwoDividerControlsNeverOverlap() {
        for gap in [0, 10, 40, 80] {
            let plan = panes(Spacing(betweenColumns: gap, betweenRows: gap))

            XCTAssertFalse(
                columnControlBox(plan).intersects(rowControlBox(plan)),
                "divider controls overlap at gap \(gap)"
            )
        }
    }

    // MARK: - What a divider control covers

    /// The control's own metrics, restated because they are private to it: a
    /// 40 × 21 field, and four arrows drawn in 28 × 20 boxes — `length` the way
    /// the arrow points, `breadth` across it.
    private static let fieldSize = CGSize(width: 40, height: 21)
    private static let arrowGap: CGFloat = 2
    private static let arrowBreadth: CGFloat = 20

    /// Along the divider, from the number's centre to an arrow's: clear of the
    /// number, by the arrow's breadth rather than its length.
    private static func alongOffset(alongHorizontal horizontal: Bool) -> CGFloat {
        (horizontal ? fieldSize.width : fieldSize.height) / 2 + arrowGap + arrowBreadth / 2
    }

    /// The column divider's four arrows point left and right, so each reaches
    /// out from the pane edge it stands against by half an arrow to be seated
    /// and half again for its own box — a whole arrow length either side of the
    /// gutter.
    private func columnControlBox(_ plan: SpacingControlLayout) -> CGRect {
        let along = Self.alongOffset(alongHorizontal: false) + Self.arrowBreadth / 2
        return CGRect(
            x: plan.columnGutter.minX - SpacingControl.arrowLength,
            y: plan.position(of: .betweenColumns).y - along,
            width: plan.columnGutter.width + SpacingControl.arrowLength * 2,
            height: along * 2
        )
    }

    private func rowControlBox(_ plan: SpacingControlLayout) -> CGRect {
        let along = Self.alongOffset(alongHorizontal: true) + Self.arrowBreadth / 2
        return CGRect(
            x: plan.position(of: .betweenRows).x - along,
            y: plan.rowGutter.minY - SpacingControl.arrowLength,
            width: along * 2,
            height: plan.rowGutter.height + SpacingControl.arrowLength * 2
        )
    }
}

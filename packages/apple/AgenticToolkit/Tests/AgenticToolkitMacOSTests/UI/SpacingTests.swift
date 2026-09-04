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
    /// (420 × 250) less the chrome that hangs off it — an arrow's length and a
    /// number beyond that, on each side — so a panel showing a frame control
    /// above a divider control gets two pictures that line up.
    private let diagram = CGRect(
        x: SpacingControlLayout.chrome.width,
        y: SpacingControlLayout.chrome.height,
        width: 420 - SpacingControlLayout.chrome.width * 2,
        height: 250 - SpacingControlLayout.chrome.height * 2
    )

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

    /// An edge's arrows meet on the line they move — the **view's** edge, not
    /// the container's. The container stays where it is however much room is
    /// asked for, so an arrow attached to it would point at a line it never
    /// touches.
    func testEachEdgesArrowsMeetOnTheMiddleOfTheEdgeOfTheViewTheyEdit() {
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

    /// The number is not on that line: it stands outside the container,
    /// centred on the edge it names, and far enough out to clear the arrows.
    /// At zero spacing the view's edge *is* the container's, which is when an
    /// arrow reaches furthest past the frame — so that is the case to measure.
    func testEachNumberStandsOutsideTheContainerClearOfItsArrows() {
        let plan = frame(Spacing())
        let field = SpacingControlLayout.fieldSize
        let reach = SpacingControlLayout.arrowLength

        let top = plan.fieldPosition(of: .top)
        XCTAssertEqual(top.x, plan.outerFrame.midX, "centred on the edge it names")
        XCTAssertGreaterThanOrEqual(top.y - field.height / 2, plan.position(of: .top).y + reach)

        let bottom = plan.fieldPosition(of: .bottom)
        XCTAssertEqual(bottom.x, plan.outerFrame.midX)
        XCTAssertLessThanOrEqual(bottom.y + field.height / 2, plan.position(of: .bottom).y - reach)

        let leading = plan.fieldPosition(of: .leading)
        XCTAssertEqual(leading.y, plan.outerFrame.midY)
        XCTAssertLessThanOrEqual(leading.x + field.width / 2, plan.position(of: .leading).x - reach)

        let trailing = plan.fieldPosition(of: .trailing)
        XCTAssertEqual(trailing.y, plan.outerFrame.midY)
        XCTAssertGreaterThanOrEqual(trailing.x - field.width / 2, plan.position(of: .trailing).x + reach)
    }

    /// The point of moving it out there: the arrows travel with the line, the
    /// number does not. It is a label on the side, not a mark on the edge.
    func testANumberHoldsStillWhileTheLineItEditsTravels() {
        for edge in SpacingEdge.allCases {
            XCTAssertEqual(
                frame(Spacing()).fieldPosition(of: edge),
                frame(Spacing(uniform: 80)).fieldPosition(of: edge),
                "\(edge)'s number moved"
            )
            XCTAssertNotEqual(
                frame(Spacing()).position(of: edge),
                frame(Spacing(uniform: 80)).position(of: edge),
                "\(edge)'s arrows did not"
            )
        }
    }

    /// A divider's number goes outside too, in line with the divider it names —
    /// above the frame for the gap between the columns, beside it for the gap
    /// between the rows. Centred on the frame instead, it would name neither.
    func testADividersNumberStandsOutsideTheFrameInLineWithItsDivider() {
        let plan = panes(Spacing(betweenColumns: 10, betweenRows: 10))

        let columns = plan.fieldPosition(of: .betweenColumns)
        XCTAssertEqual(columns.x, plan.columnGutter.midX)
        XCTAssertGreaterThan(columns.y, plan.outerFrame.maxY)

        let rows = plan.fieldPosition(of: .betweenRows)
        XCTAssertEqual(rows.y, plan.rowGutter.midY)
        XCTAssertLessThan(rows.x, plan.outerFrame.minX)
    }

    /// The two flavors are one control, so their numbers stand the same
    /// distance off the same rectangle. A panel showing one of each would
    /// otherwise line the frames up and leave the numbers ragged.
    func testBothFlavorsHangTheirNumbersTheSameDistanceOffTheFrame() {
        XCTAssertEqual(
            frame(Spacing()).fieldPosition(of: .top).y - diagram.maxY,
            panes(Spacing()).fieldPosition(of: .betweenColumns).y - diagram.maxY
        )
        XCTAssertEqual(
            frame(Spacing()).fieldPosition(of: .leading).x - diagram.minX,
            panes(Spacing()).fieldPosition(of: .betweenRows).x - diagram.minX
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
            SpacingControlLayout.arrowLength / 2,
            "an arrow can travel further than half its own length"
        )

        let travel = frame(Spacing()).position(of: .top).y
            - frame(Spacing(uniform: 80)).position(of: .top).y
        XCTAssertEqual(travel, SpacingControlLayout.maximumDisplayedInset)
        XCTAssertLessThan(travel, SpacingControlLayout.arrowLength / 2)
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

    /// Each divider's arrows are centred on the panes it separates — the column
    /// divider halfway down the top row, the row divider halfway across the
    /// left column.
    func testADividersArrowsSitInTheMiddleOfThePanesItSeparates() {
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

    /// Across the divider, from its centre to the far side of either pair of
    /// arrows: half a breadth and half a gap out to the pair's centre, and half
    /// a breadth again for the arrow itself. Nothing sits between the pairs any
    /// more — the number moved outside the frame — so this is narrower than it
    /// was, which only makes the overlap check below easier to pass.
    private static let across =
        (SpacingControlLayout.arrowBreadth + SpacingControlLayout.arrowGap) / 2
            + SpacingControlLayout.arrowBreadth / 2

    /// The column divider's four arrows point left and right, so each reaches
    /// out from the pane edge it stands against by half an arrow to be seated
    /// and half again for its own box — a whole arrow length either side of the
    /// gutter.
    private func columnControlBox(_ plan: SpacingControlLayout) -> CGRect {
        CGRect(
            x: plan.columnGutter.minX - SpacingControlLayout.arrowLength,
            y: plan.position(of: .betweenColumns).y - Self.across,
            width: plan.columnGutter.width + SpacingControlLayout.arrowLength * 2,
            height: Self.across * 2
        )
    }

    private func rowControlBox(_ plan: SpacingControlLayout) -> CGRect {
        CGRect(
            x: plan.position(of: .betweenRows).x - Self.across,
            y: plan.rowGutter.minY - SpacingControlLayout.arrowLength,
            width: Self.across * 2,
            height: plan.rowGutter.height + SpacingControlLayout.arrowLength * 2
        )
    }
}

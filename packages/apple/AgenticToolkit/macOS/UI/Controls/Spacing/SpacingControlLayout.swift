import CoreGraphics

/// Where every piece of a `SpacingControl`'s diagram goes for a given value:
/// the content rect the insets leave behind, the panes inside it, the two
/// dividers, and the points the numbers and their arrows ride.
///
/// Pure, and in the view's own (y-up) coordinates, so the placement rules — the
/// arrows hold the line they move, the number sits outside the container in
/// line with them — are testable without a window.
///
/// The chrome's own metrics live here too, rather than on the view: a number
/// that has to clear the arrows cannot be placed without knowing how long an
/// arrow is, and a rule split across two types is a rule that can disagree
/// with itself.
public struct SpacingControlLayout: Equatable {

    /// The container being spaced: the outer rectangle of the diagram.
    public let outerFrame: CGRect

    /// What is left of it once the four insets are taken off.
    public let content: CGRect

    /// The divider between the two columns, and the one between the two rows.
    /// Empty when the diagram shows a single view inside its frame.
    public let columnGutter: CGRect
    public let rowGutter: CGRect

    /// One rect for a single view, four for panes — everything the diagram
    /// fills in.
    public let panes: [CGRect]

    // MARK: - Chrome metrics

    /// A number chip, and the stepper that stands against its right edge.
    public static let fieldSize = CGSize(width: 40, height: 21)
    public static let stepperSize = CGSize(width: 13, height: 21)

    /// Between a chip and whatever sits next to it — its stepper, or an arrow.
    public static let arrowGap: CGFloat = 2

    /// A number and its stepper are placed as one block, because what has to
    /// line up with an edge is the pair. Centring the digits alone would hang
    /// the stepper off to one side of the edge it belongs to.
    public static let fieldGroupSize = CGSize(
        width: fieldSize.width + arrowGap + stepperSize.width,
        height: max(fieldSize.height, stepperSize.height)
    )

    /// An arrow is drawn in a box shaped like the glyph on it: `length` runs
    /// the way the arrow points, `breadth` across. Small, and outlined rather
    /// than filled: four of them now meet on each line, and a chip big enough
    /// to read as a button on its own crowded the picture they are drawn on.
    public static let arrowLength: CGFloat = 18
    public static let arrowBreadth: CGFloat = 14

    /// Room the diagram leaves outside itself for what hangs off it: an arrow
    /// standing against an edge, and the number and stepper beyond it.
    public static let chrome = CGSize(
        width: arrowLength + arrowGap + fieldGroupSize.width,
        height: arrowLength + arrowGap + fieldGroupSize.height
    )

    /// Reset stands below the bottom number rather than inside the diagram, so
    /// the room it needs comes off the diagram's bottom and nowhere else — the
    /// picture stays centred left to right, which is what keeps the two flavors
    /// drawing the same rectangle.
    public static let resetSize = CGSize(width: 58, height: 20)
    public static let resetGap: CGFloat = 8
    public static let footer: CGFloat = resetGap + resetSize.height

    /// From the container's edge out to the centre of a number sitting beyond
    /// it, given how far that number reaches across the gap.
    ///
    /// Clear of the arrows, not merely outside the rectangle: at zero spacing
    /// the view's edge *is* the container's, and the arrow standing against
    /// that line reaches a full arrow length past it. Both flavors use this
    /// same offset, so a panel showing one of each gets numbers at the same
    /// distance from the same rectangle.
    private static func outward(_ extent: CGFloat) -> CGFloat {
        arrowLength + arrowGap + extent / 2
    }

    /// Diagram points per point of real spacing: **one to one**.
    ///
    /// It was a fraction while the range ran to 80, because 80 points a side
    /// would have swallowed a diagram this size. The range now stops at 40,
    /// which this diagram has room for, so the preview can say *how many*
    /// rather than merely *more* or *less* — ten points of spacing is ten
    /// points of picture.
    private static let displayScale: CGFloat = 1

    /// The furthest the drawing ever moves — the top of the range, drawn at
    /// full size, so every number the user can reach changes the picture.
    ///
    /// This used to be a small fraction of the range, and the arrows were the
    /// reason: they stand against the edges they move, so they move too, and
    /// one held past half its own length slid out from under the pointer and
    /// stopped repeating. A pressed arrow now keeps its seat until it is
    /// released (`ArrowButton`), which is what let the cap rise to meet the
    /// range instead of holding the diagram still above 17.
    public static let maximumDisplayedInset: CGFloat = 40

    /// A divider narrower than this is still drawn as a hairline, so the
    /// diagram reads as four panes rather than one at zero.
    private static let minimumDisplayedGutter: CGFloat = 1

    /// The margin the pane diagram leaves around its grid. Deliberately fixed:
    /// the space around the grid is the *frame* control's number, and a margin
    /// that moved here would read as one this diagram edits.
    public static let paneGridMargin: CGFloat = 8

    public static func displayed(_ value: Int) -> CGFloat {
        min(CGFloat(value) * displayScale, maximumDisplayedInset)
    }

    public init(diagram: CGRect, spacing: Spacing, style: SpacingDiagram) {
        self.outerFrame = diagram

        guard style == .paneDividers else {
            self.content = CGRect(
                x: diagram.minX + Self.displayed(spacing.leading),
                y: diagram.minY + Self.displayed(spacing.bottom),
                width: max(diagram.width - Self.displayed(spacing.leading) - Self.displayed(spacing.trailing), 0),
                height: max(diagram.height - Self.displayed(spacing.top) - Self.displayed(spacing.bottom), 0)
            )
            self.columnGutter = .zero
            self.rowGutter = .zero
            self.panes = [content]
            return
        }

        let content = diagram.insetBy(dx: Self.paneGridMargin, dy: Self.paneGridMargin)
        self.content = content

        let columnWidth = max(Self.displayed(spacing.betweenColumns), Self.minimumDisplayedGutter)
        let rowHeight = max(Self.displayed(spacing.betweenRows), Self.minimumDisplayedGutter)

        let columnGutter = CGRect(
            x: content.midX - columnWidth / 2,
            y: content.minY,
            width: columnWidth,
            height: content.height
        )
        let rowGutter = CGRect(
            x: content.minX,
            y: content.midY - rowHeight / 2,
            width: content.width,
            height: rowHeight
        )
        self.columnGutter = columnGutter
        self.rowGutter = rowGutter

        let leftWidth = max(columnGutter.minX - content.minX, 0)
        let rightWidth = max(content.maxX - columnGutter.maxX, 0)
        let lowerHeight = max(rowGutter.minY - content.minY, 0)
        let upperHeight = max(content.maxY - rowGutter.maxY, 0)

        self.panes = [
            CGRect(x: content.minX, y: rowGutter.maxY, width: leftWidth, height: upperHeight),
            CGRect(x: columnGutter.maxX, y: rowGutter.maxY, width: rightWidth, height: upperHeight),
            CGRect(x: content.minX, y: content.minY, width: leftWidth, height: lowerHeight),
            CGRect(x: columnGutter.maxX, y: content.minY, width: rightWidth, height: lowerHeight)
        ]
    }

    /// Where an edge's two arrows are centred: on the middle of that edge **of
    /// the view**, one either side of the line, tips meeting on it.
    ///
    /// The line a number moves is the content's, not the frame's — the frame
    /// is the container, and it stays where it is however much room is asked
    /// for. So this is the line an arrow has to be attached to for pressing it
    /// to move what it points at. It does travel as the value changes, which
    /// is what ``maximumDisplayedInset`` is sized against.
    public func position(of edge: SpacingEdge) -> CGPoint {
        switch edge {
        case .top: return CGPoint(x: content.midX, y: content.maxY)
        case .bottom: return CGPoint(x: content.midX, y: content.minY)
        case .leading: return CGPoint(x: content.minX, y: content.midY)
        case .trailing: return CGPoint(x: content.maxX, y: content.midY)
        }
    }

    /// Where a divider's four arrows are centred: on the divider, and in the
    /// middle of the panes it separates — the column
    /// divider halfway down the top row, the row divider halfway across the
    /// left column.
    ///
    /// The two dividers cross, so something has to keep their controls apart;
    /// putting each in the middle of a *different* pane does that as a
    /// by-product of putting it where it belongs.
    public func position(of gutter: SpacingGutter) -> CGPoint {
        switch gutter {
        case .betweenColumns:
            return CGPoint(x: columnGutter.midX, y: (rowGutter.maxY + content.maxY) / 2)
        case .betweenRows:
            return CGPoint(x: (content.minX + columnGutter.minX) / 2, y: rowGutter.midY)
        }
    }

    /// Where an edge's number sits: **outside** the container, centred on the
    /// edge it belongs to.
    ///
    /// The arrows own the line — they are attached to it and travel with it —
    /// and a number attached to the same line had to share the room with them,
    /// which is what pushed all three along the edge and away from the middle.
    /// Out here the number is a label on the whole edge: it holds still, it is
    /// centred on the side it names, and the line is left to the two controls
    /// that move it.
    public func fieldPosition(of edge: SpacingEdge) -> CGPoint {
        switch edge {
        case .top:
            return CGPoint(x: outerFrame.midX, y: outerFrame.maxY + Self.outward(Self.fieldGroupSize.height))
        case .bottom:
            return CGPoint(x: outerFrame.midX, y: outerFrame.minY - Self.outward(Self.fieldGroupSize.height))
        case .leading:
            return CGPoint(x: outerFrame.minX - Self.outward(Self.fieldGroupSize.width), y: outerFrame.midY)
        case .trailing:
            return CGPoint(x: outerFrame.maxX + Self.outward(Self.fieldGroupSize.width), y: outerFrame.midY)
        }
    }

    /// Where a divider's number sits: outside the container, in line with the
    /// divider it belongs to — above the frame for the gap between the columns,
    /// beside it for the gap between the rows.
    ///
    /// Same reasoning as the edges', and the same distance out, so the two
    /// flavors read as one control with two pictures in it. In line with the
    /// divider rather than centred on the frame, because a number floating over
    /// the middle of a four-pane grid names neither gap.
    public func fieldPosition(of gutter: SpacingGutter) -> CGPoint {
        switch gutter {
        case .betweenColumns:
            return CGPoint(x: columnGutter.midX, y: outerFrame.maxY + Self.outward(Self.fieldGroupSize.height))
        case .betweenRows:
            return CGPoint(x: outerFrame.minX - Self.outward(Self.fieldGroupSize.width), y: rowGutter.midY)
        }
    }
}

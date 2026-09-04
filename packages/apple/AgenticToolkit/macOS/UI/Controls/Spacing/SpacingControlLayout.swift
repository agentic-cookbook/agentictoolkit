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

    /// A number chip.
    public static let fieldSize = CGSize(width: 40, height: 21)

    /// An arrow is drawn in a box shaped like the glyph on it: `length` runs
    /// the way the arrow points, `breadth` across. Deliberately large — these
    /// are the controls, not annotations on a drawing, and a 22-point chip read
    /// as the latter.
    public static let arrowLength: CGFloat = 28
    public static let arrowBreadth: CGFloat = 20

    /// Between a chip and whatever sits next to it.
    public static let arrowGap: CGFloat = 2

    /// Room the diagram leaves outside itself for what hangs off it: an arrow
    /// standing against an edge, and the number beyond it.
    public static let chrome = CGSize(
        width: arrowLength + arrowGap + fieldSize.width,
        height: arrowLength + arrowGap + fieldSize.height
    )

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

    /// Diagram points per point of real spacing.
    ///
    /// Not 1:1, and capped: at 1:1 an 80-point inset would swallow a diagram
    /// this size, and the cap is what keeps the content visible at the top of
    /// the range. The preview says *more* or *less*, not *how many* — that is
    /// the number's job.
    private static let displayScale: CGFloat = 0.7

    /// How far anything anchored to a moving line can travel over the whole
    /// range — and so the reason this number is small.
    ///
    /// The arrows stand against the edges they move, which means they move
    /// too. An arrow held down would slide out from under the pointer, and
    /// stop repeating, the moment it travelled half its own length; the cap is
    /// kept under that. See ``arrowLength`` and
    /// `testAHeldArrowCannotTravelOutFromUnderThePointer`.
    public static let maximumDisplayedInset: CGFloat = 12

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
            return CGPoint(x: outerFrame.midX, y: outerFrame.maxY + Self.outward(Self.fieldSize.height))
        case .bottom:
            return CGPoint(x: outerFrame.midX, y: outerFrame.minY - Self.outward(Self.fieldSize.height))
        case .leading:
            return CGPoint(x: outerFrame.minX - Self.outward(Self.fieldSize.width), y: outerFrame.midY)
        case .trailing:
            return CGPoint(x: outerFrame.maxX + Self.outward(Self.fieldSize.width), y: outerFrame.midY)
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
            return CGPoint(x: columnGutter.midX, y: outerFrame.maxY + Self.outward(Self.fieldSize.height))
        case .betweenRows:
            return CGPoint(x: outerFrame.minX - Self.outward(Self.fieldSize.width), y: rowGutter.midY)
        }
    }
}

import CoreGraphics

/// Where every piece of a `SpacingControl`'s diagram goes for a given value:
/// the content rect the insets leave behind, the panes inside it, the two
/// dividers, and the points the numbers and their arrows ride.
///
/// Pure, and in the view's own (y-up) coordinates, so the placement rules — a
/// number sits on the edge it changes, a divider's number sits in the middle
/// of the panes it separates — are testable without a window.
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

    /// Diagram points per point of real spacing.
    ///
    /// Not 1:1, and capped: at 1:1 an 80-point inset would swallow a diagram
    /// this size, and the cap is what keeps the content visible at the top of
    /// the range. The preview says *more* or *less*, not *how many* — that is
    /// the number's job.
    private static let displayScale: CGFloat = 0.7
    private static let maximumDisplayedInset: CGFloat = 20

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

    /// Where an edge's number and its two arrows are centred: on the middle of
    /// that edge of the frame, straddling the line.
    ///
    /// The frame is the one rectangle that does not move as the numbers change,
    /// which is exactly what a control wants to be attached to — the alternative
    /// is a row of arrows that slide out from under the pointer as they are
    /// pressed.
    public func position(of edge: SpacingEdge) -> CGPoint {
        switch edge {
        case .top: return CGPoint(x: outerFrame.midX, y: outerFrame.maxY)
        case .bottom: return CGPoint(x: outerFrame.midX, y: outerFrame.minY)
        case .leading: return CGPoint(x: outerFrame.minX, y: outerFrame.midY)
        case .trailing: return CGPoint(x: outerFrame.maxX, y: outerFrame.midY)
        }
    }

    /// Where a divider's number and its two buttons are centred: on the
    /// divider, and in the middle of the panes it separates — the column
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
}

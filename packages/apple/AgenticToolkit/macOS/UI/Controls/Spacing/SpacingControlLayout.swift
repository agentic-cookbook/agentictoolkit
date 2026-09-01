import CoreGraphics

/// Where every piece of a `SpacingControl`'s diagram goes for a given value:
/// the content rect the insets leave behind, the panes inside it, the two
/// gutters, and the points the arrow clusters ride.
///
/// Pure, and in the view's own (y-up) coordinates, so the placement rules —
/// a cluster sits on its corner, a gutter control sits on its gutter — are
/// testable without a window.
public struct SpacingControlLayout: Equatable {

    /// The container being spaced: the outer rectangle of the diagram.
    public let outerFrame: CGRect

    /// What is left of it once the four insets are taken off.
    public let content: CGRect

    /// The gutter between the two columns, and the one between the two rows.
    /// Empty when the diagram shows a single view.
    public let columnGutter: CGRect
    public let rowGutter: CGRect

    /// One rect for a single view, four for panes — everything the diagram
    /// fills in.
    public let panes: [CGRect]

    /// Diagram points per point of real spacing.
    ///
    /// Not 1:1, and capped: at 1:1 an 80-point inset would swallow a diagram
    /// this size, and the cap is what keeps the panes visible at the top of the
    /// range. The preview says *more* or *less*, not *how many* — that is the
    /// number's job.
    private static let displayScale: CGFloat = 0.7
    private static let maximumDisplayedInset: CGFloat = 20

    /// A gutter narrower than this is still drawn as a hairline, so the
    /// diagram reads as two panes rather than one at zero.
    private static let minimumDisplayedGutter: CGFloat = 1

    /// How far in from the content's edge a gutter control sits.
    ///
    /// The two of them ride the same crossing, so each is pushed to the far end
    /// of its own gutter: the column control to the top, the row control to the
    /// left. With the diagram at its designed size that keeps their boxes
    /// clear of each other at every value in range — which is why the diagram
    /// is as wide as it is.
    private static let gutterControlInset: CGFloat = 24

    public static func displayed(_ value: Int) -> CGFloat {
        min(CGFloat(value) * displayScale, maximumDisplayedInset)
    }

    public init(diagram: CGRect, spacing: Spacing, showsGutters: Bool) {
        self.outerFrame = diagram

        let content = CGRect(
            x: diagram.minX + Self.displayed(spacing.leading),
            y: diagram.minY + Self.displayed(spacing.bottom),
            width: max(diagram.width - Self.displayed(spacing.leading) - Self.displayed(spacing.trailing), 0),
            height: max(diagram.height - Self.displayed(spacing.top) - Self.displayed(spacing.bottom), 0)
        )
        self.content = content

        guard showsGutters else {
            self.columnGutter = .zero
            self.rowGutter = .zero
            self.panes = [content]
            return
        }

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

    /// Where the four-arrow cluster for `corner` is centred: on the corner of
    /// the content rect, so the cluster travels with the edge it moves.
    public func position(of corner: SpacingCorner) -> CGPoint {
        CGPoint(
            x: corner.isLeading ? content.minX : content.maxX,
            y: corner.isTop ? content.maxY : content.minY
        )
    }

    /// Where a gutter's field and its two buttons are centred: on the gutter,
    /// at the far end of it from where the two gutters cross.
    public func position(of gutter: SpacingGutter) -> CGPoint {
        switch gutter {
        case .betweenColumns:
            return CGPoint(x: columnGutter.midX, y: content.maxY - Self.gutterControlInset)
        case .betweenRows:
            return CGPoint(x: content.minX + Self.gutterControlInset, y: rowGutter.midY)
        }
    }
}

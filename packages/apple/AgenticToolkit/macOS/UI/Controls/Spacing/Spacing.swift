import Foundation

/// How much room sits around a view — and, when the thing being spaced is a
/// grid of panes, between them.
///
/// One type serves both flavors of `SpacingControl`. The frame flavor leaves
/// the two gutters alone and never shows them; a second type differing by two
/// fields would make every caller convert between the two for no gain
/// (`simplicity`).
public struct Spacing: Equatable, Sendable, Codable {

    /// Inset from the container's own edge, in points.
    public var top: Int
    public var leading: Int
    public var bottom: Int
    public var trailing: Int

    /// Space between two panes standing side by side — measured across, so it
    /// is the width of the gutter that separates two columns.
    public var betweenColumns: Int

    /// Space between two panes stacked one above the other.
    public var betweenRows: Int

    public init(
        top: Int = 0,
        leading: Int = 0,
        bottom: Int = 0,
        trailing: Int = 0,
        betweenColumns: Int = 0,
        betweenRows: Int = 0
    ) {
        self.top = top
        self.leading = leading
        self.bottom = bottom
        self.trailing = trailing
        self.betweenColumns = betweenColumns
        self.betweenRows = betweenRows
    }

    /// The same number on every side and in both gutters.
    public init(uniform value: Int) {
        self.init(
            top: value,
            leading: value,
            bottom: value,
            trailing: value,
            betweenColumns: value,
            betweenRows: value
        )
    }
}

/// Which picture a `SpacingControl` draws, and so which of the six numbers it
/// edits.
///
/// The two are separate controls rather than one control with an optional half:
/// they answer different questions — how much room *around* the thing, how much
/// room *between* the things — and a panel that cares about both wants to say
/// so twice, with a heading over each.
public enum SpacingDiagram: String, CaseIterable, Sendable {
    /// One view inside its container: the four insets around it.
    case frame
    /// Four panes and the two dividers between them.
    case paneDividers
}

/// One of the four insets, named so a control can talk about "the edge this
/// field edits" without four near-identical code paths.
public enum SpacingEdge: String, CaseIterable, Sendable {
    case top, leading, bottom, trailing

    /// The label a settings panel puts beside the field.
    public var displayName: String {
        switch self {
        case .top: return "Top"
        case .leading: return "Left"
        case .bottom: return "Bottom"
        case .trailing: return "Right"
        }
    }

    /// True for the two edges whose controls stand in a row.
    public var isHorizontal: Bool { self == .top || self == .bottom }

    /// The way out of the frame across this edge — which is the way the arrow
    /// that *adds* space points. Every arrow in the frame control is one of
    /// these two, so "which number, which direction" never needs a table.
    public var outward: SpacingArrow {
        switch self {
        case .top: return .up
        case .bottom: return .down
        case .leading: return .left
        case .trailing: return .right
        }
    }

    /// The way into the content across this edge: the arrow that takes room
    /// away.
    public var inward: SpacingArrow { outward.opposite }
}

/// One of the two gutters. Only the pane-divider flavor has them.
public enum SpacingGutter: String, CaseIterable, Sendable {
    /// Between panes side by side — a vertical gutter, measured across.
    case betweenColumns
    /// Between panes stacked — a horizontal gutter, measured down.
    case betweenRows

    /// How a tooltip names the gap this divider makes.
    public var displayName: String {
        switch self {
        case .betweenColumns: return "side-by-side panes"
        case .betweenRows: return "stacked panes"
        }
    }
}

/// Which way one arrow points.
public enum SpacingArrow: String, CaseIterable, Sendable {
    // The raw values are the SF Symbol suffixes, so "up" is the name the
    // symbol has; a three-letter synonym would only be there to satisfy a
    // length rule.
    // swiftlint:disable:next identifier_name
    case up, down, left, right

    /// The SF Symbol drawn on the button.
    public var symbolName: String { "arrow.\(rawValue)" }

    public var opposite: SpacingArrow {
        switch self {
        case .up: return .down
        case .down: return .up
        case .left: return .right
        case .right: return .left
        }
    }
}

extension Spacing {

    public subscript(edge: SpacingEdge) -> Int {
        get {
            switch edge {
            case .top: return top
            case .leading: return leading
            case .bottom: return bottom
            case .trailing: return trailing
            }
        }
        set {
            switch edge {
            case .top: top = newValue
            case .leading: leading = newValue
            case .bottom: bottom = newValue
            case .trailing: trailing = newValue
            }
        }
    }

    public subscript(gutter: SpacingGutter) -> Int {
        get {
            switch gutter {
            case .betweenColumns: return betweenColumns
            case .betweenRows: return betweenRows
            }
        }
        set {
            switch gutter {
            case .betweenColumns: betweenColumns = newValue
            case .betweenRows: betweenRows = newValue
            }
        }
    }

    /// The value after adding or taking away `delta` points of room on `edge`.
    ///
    /// One edge, one number, either direction — the arrow beside the number
    /// says which. (An earlier design hung four arrows off each *corner*, where
    /// "up" meant more room at the top and less at the bottom; two arrows on
    /// the edge they move say the same thing without the reader having to work
    /// out which corner they are looking at.)
    public func adjusting(_ edge: SpacingEdge, by delta: Int, in range: ClosedRange<Int>) -> Spacing {
        var adjusted = self
        adjusted[edge] = (self[edge] + delta).clamped(to: range)
        return adjusted
    }

    /// The value after opening or closing `gutter` by `delta` points.
    public func adjusting(_ gutter: SpacingGutter, by delta: Int, in range: ClosedRange<Int>) -> Spacing {
        var adjusted = self
        adjusted[gutter] = (self[gutter] + delta).clamped(to: range)
        return adjusted
    }

    /// The value with `edge` set to a typed number, clamped to what the control
    /// accepts.
    public func setting(_ edge: SpacingEdge, to value: Int, in range: ClosedRange<Int>) -> Spacing {
        var updated = self
        updated[edge] = value.clamped(to: range)
        return updated
    }

    /// The value with `gutter` set to a typed number, clamped.
    public func setting(_ gutter: SpacingGutter, to value: Int, in range: ClosedRange<Int>) -> Spacing {
        var updated = self
        updated[gutter] = value.clamped(to: range)
        return updated
    }
}

/// `Core` already gives `CGFloat` one of these; widening that to `Comparable`
/// would put a protocol-extension member in scope everywhere the concrete one
/// is used, so this stays an `Int` of its own.
extension Int {
    func clamped(to range: ClosedRange<Int>) -> Int {
        Swift.min(Swift.max(self, range.lowerBound), range.upperBound)
    }
}

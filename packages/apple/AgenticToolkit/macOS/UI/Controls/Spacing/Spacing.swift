import Foundation

/// How much room sits around a view — and, when the thing being spaced is a
/// grid of panes, between them.
///
/// One type serves both flavors of `SpacingControl`. The single-view flavor
/// leaves the two gutters alone and never shows them; a second type differing
/// by two fields would make every caller convert between the two for no gain
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
}

/// One of the two gutters. Only the pane flavor has them.
public enum SpacingGutter: String, CaseIterable, Sendable {
    /// Between panes side by side — a vertical gutter, measured across.
    case betweenColumns
    /// Between panes stacked — a horizontal gutter, measured down.
    case betweenRows
}

/// A corner of the content rect, where a four-arrow cluster sits.
public enum SpacingCorner: String, CaseIterable, Sendable {
    case topLeading, topTrailing, bottomLeading, bottomTrailing

    var isTop: Bool { self == .topLeading || self == .topTrailing }
    var isLeading: Bool { self == .topLeading || self == .bottomLeading }
}

/// Which way one arrow of a cluster points.
public enum SpacingArrow: String, CaseIterable, Sendable {
    // The raw values are the SF Symbol suffixes, so "up" is the name the
    // symbol has; a three-letter synonym would only be there to satisfy a
    // length rule.
    // swiftlint:disable:next identifier_name
    case up, down, left, right

    /// The SF Symbol drawn on the button.
    public var symbolName: String { "arrow.\(rawValue)" }
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

    /// The value after clicking `arrow` of the cluster at `corner`.
    ///
    /// The arrow says where the *corner* goes, not which way a number counts:
    /// at the top-left, "down" is more top inset, and at the bottom-left the
    /// same arrow is less bottom inset. That is the whole reason a corner
    /// carries four arrows instead of two.
    public func moving(_ corner: SpacingCorner, _ arrow: SpacingArrow, in range: ClosedRange<Int>) -> Spacing {
        let change = corner.change(for: arrow)
        var moved = self
        moved[change.edge] = (self[change.edge] + change.delta).clamped(to: range)
        return moved
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

extension SpacingCorner {

    /// Which inset an arrow at this corner moves, and which way.
    public func change(for arrow: SpacingArrow) -> (edge: SpacingEdge, delta: Int) {
        switch arrow {
        case .up:
            return (isTop ? .top : .bottom, isTop ? -1 : 1)
        case .down:
            return (isTop ? .top : .bottom, isTop ? 1 : -1)
        case .left:
            return (isLeading ? .leading : .trailing, isLeading ? -1 : 1)
        case .right:
            return (isLeading ? .leading : .trailing, isLeading ? 1 : -1)
        }
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

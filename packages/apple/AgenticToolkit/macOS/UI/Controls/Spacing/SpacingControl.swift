import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A picture of the thing being spaced, with the numbers attached to the edges
/// they belong to.
///
/// Four text fields and a column of labels can say the same thing, but they
/// cannot say *which* edge is which without the reader building the picture in
/// their head. Here the diagram is the control: a cluster of arrows rides each
/// corner of the content and moves it a point at a time, and the number beside
/// each edge takes a typed value.
///
/// Two flavors:
/// - `.singleView` — one view inside its container: four insets.
/// - `.panes` — a grid of panes: the same four insets, plus the two gutters.
///   A gutter is shared by the panes on either side of it, so ten points means
///   ten points of gap, not ten from each side; its two buttons close and open
///   it rather than moving one edge, because there is no one edge to move.
///
/// The control knows nothing about settings or about what it is spacing. It
/// holds a `Spacing` and reports changes; wiring that to a setting, and
/// applying it to a window, is the caller's job (`separation-of-concerns`).
@MainActor
public final class SpacingControl: NSView, NSTextFieldDelegate {

    public enum Style {
        /// One view inside its container: the four insets, no gutters.
        case singleView
        /// A grid of panes: the four insets and the two gutters.
        case panes

        var showsGutters: Bool { self == .panes }
    }

    /// Fired when the *user* changes the value — clicking an arrow, typing a
    /// number, or pressing an arrow key in a field. Assigning `value` does not
    /// fire it, so a control bound to a setting cannot feed its own write back
    /// to itself.
    public var onChange: ((Spacing) -> Void)?

    /// The spacing shown. Setting it redraws; it does not call `onChange`.
    public var value: Spacing {
        didSet {
            guard value != oldValue else { return }
            sync()
        }
    }

    public let style: Style

    /// Whatever keeps this control's numbers in sync with wherever they are
    /// stored. Held here so `boundToSettings` can hand back one object rather
    /// than a pair the caller has to keep together.
    var retainedBinding: AnyObject?

    /// What the fields and the arrows will accept. Zero is a legitimate answer
    /// — "no gap at all" is a look — so the floor is 0, not 1.
    public let range: ClosedRange<Int>

    // MARK: - Metrics

    /// Wide enough that the two gutter controls stay clear of each other at
    /// the top of the inset range, where the content rect is at its smallest —
    /// see `SpacingControlLayout.gutterControlInset`.
    private static let diagramSize = CGSize(width: 240, height: 150)
    private static let fieldSize = CGSize(width: 44, height: 21)
    /// Room between the diagram and the outer fields — enough that a cluster
    /// sitting on a zero inset, and so hanging fully outside the frame, still
    /// clears the field beside it.
    private static let fieldGap: CGFloat = 26
    private static let arrowSize: CGFloat = 15
    private static let gutterButtonSize: CGFloat = 18
    /// How far each arrow of a cluster sits from the corner it moves.
    private static let clusterRadius: CGFloat = 15

    // MARK: - Subviews

    private enum ArrowAction {
        case corner(SpacingCorner, SpacingArrow)
        case gutter(SpacingGutter, Int)
    }

    private enum FieldTarget {
        case edge(SpacingEdge)
        case gutter(SpacingGutter)
    }

    private var edgeFields: [SpacingEdge: NSTextField] = [:]
    private var gutterFields: [SpacingGutter: NSTextField] = [:]
    private var cornerButtons: [SpacingCorner: [SpacingArrow: NSButton]] = [:]
    /// Per gutter: the button that closes it and the button that opens it.
    private var gutterButtons: [SpacingGutter: (narrower: NSButton, wider: NSButton)] = [:]

    private var arrowActions: [ObjectIdentifier: ArrowAction] = [:]
    private var fieldTargets: [ObjectIdentifier: FieldTarget] = [:]

    private var palette: SemanticPalette = ThemePaletteObserver.currentPalette

    // MARK: - Init

    public init(style: Style, value: Spacing = Spacing(), range: ClosedRange<Int> = 0...80) {
        self.style = style
        self.value = value
        self.range = range
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        buildEdgeFields()
        buildCornerClusters()
        if style.showsGutters {
            buildGutterControls()
        }

        observeTheme { control, palette in
            control.palette = palette
            control.needsDisplay = true
        }

        sync()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override var intrinsicContentSize: NSSize {
        NSSize(
            width: Self.fieldSize.width * 2 + Self.fieldGap * 2 + Self.diagramSize.width,
            height: Self.fieldSize.height * 2 + Self.fieldGap * 2 + Self.diagramSize.height
        )
    }

    // MARK: - Building

    private func buildEdgeFields() {
        for edge in SpacingEdge.allCases {
            let field = makeField(accessibility: "spacing.\(edge.rawValue)")
            field.toolTip = "\(edge.displayName) — points between the edge and what is inside it"
            fieldTargets[ObjectIdentifier(field)] = .edge(edge)
            edgeFields[edge] = field
            addSubview(field)
        }
    }

    private func buildCornerClusters() {
        for corner in SpacingCorner.allCases {
            var arrows: [SpacingArrow: NSButton] = [:]
            for arrow in SpacingArrow.allCases {
                let change = corner.change(for: arrow)
                let button = makeArrowButton(
                    symbol: arrow.symbolName,
                    accessibility: "spacing.corner.\(corner.rawValue).\(arrow.rawValue)",
                    tooltip: "\(change.delta > 0 ? "More" : "Less") \(change.edge.displayName.lowercased()) space"
                )
                arrowActions[ObjectIdentifier(button)] = .corner(corner, arrow)
                arrows[arrow] = button
                addSubview(button)
            }
            cornerButtons[corner] = arrows
        }
    }

    private func buildGutterControls() {
        for gutter in SpacingGutter.allCases {
            let field = makeField(accessibility: "spacing.\(gutter.rawValue)")
            field.toolTip = Self.gutterDescription(gutter)
            fieldTargets[ObjectIdentifier(field)] = .gutter(gutter)
            gutterFields[gutter] = field
            addSubview(field)

            let narrower = makeArrowButton(
                symbol: Self.gutterSymbol(gutter, narrower: true),
                accessibility: "spacing.gutter.\(gutter.rawValue).narrower",
                tooltip: "Less space between panes"
            )
            let wider = makeArrowButton(
                symbol: Self.gutterSymbol(gutter, narrower: false),
                accessibility: "spacing.gutter.\(gutter.rawValue).wider",
                tooltip: "More space between panes"
            )
            arrowActions[ObjectIdentifier(narrower)] = .gutter(gutter, -1)
            arrowActions[ObjectIdentifier(wider)] = .gutter(gutter, 1)
            addSubview(narrower)
            addSubview(wider)
            gutterButtons[gutter] = (narrower, wider)
        }
    }

    /// Arrows pointing at a line close the gap; arrows pointing away from it
    /// open the gap. The line in the symbol is the gutter, which is why these
    /// read without a label.
    private static func gutterSymbol(_ gutter: SpacingGutter, narrower: Bool) -> String {
        switch gutter {
        case .betweenColumns:
            return narrower
                ? "arrow.right.and.line.vertical.and.arrow.left"
                : "arrow.left.and.line.vertical.and.arrow.right"
        case .betweenRows:
            return narrower
                ? "arrow.down.and.line.horizontal.and.arrow.up"
                : "arrow.up.and.line.horizontal.and.arrow.down"
        }
    }

    private static func gutterDescription(_ gutter: SpacingGutter) -> String {
        switch gutter {
        case .betweenColumns:
            return "Points between two panes side by side. The gap is shared, so this is the whole gap."
        case .betweenRows:
            return "Points between two panes stacked. The gap is shared, so this is the whole gap."
        }
    }

    private func makeField(accessibility: String) -> NSTextField {
        let field = NSTextField()
        let formatter = NumberFormatter()
        formatter.numberStyle = .none
        formatter.allowsFloats = false
        formatter.minimum = NSNumber(value: range.lowerBound)
        formatter.maximum = NSNumber(value: range.upperBound)
        field.formatter = formatter
        field.alignment = .center
        field.delegate = self
        field.target = self
        field.action = #selector(fieldChanged(_:))
        field.translatesAutoresizingMaskIntoConstraints = true
        field.observeTheme { field, palette in
            field.font = palette.font(.code)
            field.textColor = palette.nsColor(.primaryText)
        }
        return field.accessibilityID(accessibility)
    }

    /// The button is sized in `layout()`, so the caller passes only what the
    /// button *is*, never how big it is.
    private func makeArrowButton(symbol: String, accessibility: String, tooltip: String) -> NSButton {
        let image = NSImage(systemSymbolName: symbol, accessibilityDescription: tooltip)
        let button = NSButton(image: image ?? NSImage(), target: self, action: #selector(arrowClicked(_:)))
        button.isBordered = false
        button.setButtonType(.momentaryChange)
        button.imageScaling = .scaleProportionallyDown
        button.toolTip = tooltip
        button.translatesAutoresizingMaskIntoConstraints = true
        // Held down, an arrow repeats — a control that moves by one point is
        // otherwise a click per point.
        button.isContinuous = true
        button.setPeriodicDelay(0.45, interval: 0.06)
        button.observeTheme { button, palette in
            button.contentTintColor = palette.nsColor(.primaryText)
        }
        return button.accessibilityID(accessibility)
    }

    // MARK: - Actions

    @objc private func arrowClicked(_ sender: NSButton) {
        guard let action = arrowActions[ObjectIdentifier(sender)] else { return }
        switch action {
        case .corner(let corner, let arrow):
            apply(value.moving(corner, arrow, in: range))
        case .gutter(let gutter, let delta):
            apply(value.adjusting(gutter, by: delta, in: range))
        }
    }

    @objc private func fieldChanged(_ sender: NSTextField) {
        commit(sender)
    }

    /// Committing on every keystroke would fight the user mid-number (a "1" on
    /// the way to "12"), so a typed value lands when editing ends — Return, Tab
    /// or clicking away.
    public func controlTextDidEndEditing(_ obj: Notification) {
        guard let field = obj.object as? NSTextField else { return }
        commit(field)
    }

    /// Up and down adjust the focused field by a point. Left and right are left
    /// to the caret: they are how you edit the number that is already there.
    public func control(_ control: NSControl, textView: NSTextView, doCommandBy selector: Selector) -> Bool {
        guard let field = control as? NSTextField,
              let target = fieldTargets[ObjectIdentifier(field)] else { return false }
        let delta: Int
        switch selector {
        case #selector(NSResponder.moveUp(_:)): delta = 1
        case #selector(NSResponder.moveDown(_:)): delta = -1
        default: return false
        }
        switch target {
        case .edge(let edge):
            apply(value.setting(edge, to: value[edge] + delta, in: range))
        case .gutter(let gutter):
            apply(value.adjusting(gutter, by: delta, in: range))
        }
        // The field is mid-edit and holds the old text; `sync` has replaced the
        // value under it, so the editor has to be told to catch up.
        textView.string = field.stringValue
        textView.setSelectedRange(NSRange(location: textView.string.count, length: 0))
        return true
    }

    private func commit(_ field: NSTextField) {
        guard let target = fieldTargets[ObjectIdentifier(field)] else { return }
        switch target {
        case .edge(let edge):
            apply(value.setting(edge, to: field.integerValue, in: range))
        case .gutter(let gutter):
            apply(value.setting(gutter, to: field.integerValue, in: range))
        }
        // A typed value out of range was clamped; show what was actually taken.
        sync()
    }

    private func apply(_ newValue: Spacing) {
        guard newValue != value else { return }
        value = newValue
        onChange?(newValue)
    }

    // MARK: - Sync and layout

    private func sync() {
        for (edge, field) in edgeFields where !isEditing(field) {
            field.integerValue = value[edge]
        }
        for (gutter, field) in gutterFields where !isEditing(field) {
            field.integerValue = value[gutter]
        }
        needsLayout = true
        needsDisplay = true
    }

    /// A field the user is typing in owns its own text until they are done.
    private func isEditing(_ field: NSTextField) -> Bool {
        field.currentEditor() != nil
    }

    private var diagramRect: CGRect {
        CGRect(
            x: Self.fieldSize.width + Self.fieldGap,
            y: Self.fieldSize.height + Self.fieldGap,
            width: Self.diagramSize.width,
            height: Self.diagramSize.height
        )
    }

    private var layoutPlan: SpacingControlLayout {
        SpacingControlLayout(diagram: diagramRect, spacing: value, showsGutters: style.showsGutters)
    }

    public override func layout() {
        super.layout()

        let diagram = diagramRect
        let plan = layoutPlan
        let field = Self.fieldSize

        place(edgeFields[.top], at: CGPoint(x: diagram.midX, y: diagram.maxY + Self.fieldGap + field.height / 2))
        place(edgeFields[.bottom], at: CGPoint(x: diagram.midX, y: field.height / 2))
        place(edgeFields[.leading], at: CGPoint(x: field.width / 2, y: diagram.midY))
        place(
            edgeFields[.trailing],
            at: CGPoint(x: diagram.maxX + Self.fieldGap + field.width / 2, y: diagram.midY)
        )

        for (corner, arrows) in cornerButtons {
            let origin = plan.position(of: corner)
            for (arrow, button) in arrows {
                place(button, at: Self.offset(origin, towards: arrow, by: Self.clusterRadius), size: arrowBox)
            }
        }

        for (gutter, field) in gutterFields {
            let origin = plan.position(of: gutter)
            place(field, at: origin)
            guard let buttons = gutterButtons[gutter] else { continue }
            let step = gutterButtonOffset(for: gutter)
            switch gutter {
            case .betweenColumns:
                place(buttons.narrower, at: CGPoint(x: origin.x, y: origin.y + step), size: gutterBox)
                place(buttons.wider, at: CGPoint(x: origin.x, y: origin.y - step), size: gutterBox)
            case .betweenRows:
                place(buttons.narrower, at: CGPoint(x: origin.x - step, y: origin.y), size: gutterBox)
                place(buttons.wider, at: CGPoint(x: origin.x + step, y: origin.y), size: gutterBox)
            }
        }
    }

    private var arrowBox: CGSize { CGSize(width: Self.arrowSize, height: Self.arrowSize) }
    private var gutterBox: CGSize { CGSize(width: Self.gutterButtonSize, height: Self.gutterButtonSize) }

    /// Far enough from the field that the two do not touch. The column pair
    /// stacks above and below it, so it clears the field's height; the row pair
    /// sits either side, so it clears the width.
    private func gutterButtonOffset(for gutter: SpacingGutter) -> CGFloat {
        let extent = gutter == .betweenColumns ? Self.fieldSize.height : Self.fieldSize.width
        return extent / 2 + Self.gutterButtonSize / 2 + 2
    }

    private static func offset(_ point: CGPoint, towards arrow: SpacingArrow, by distance: CGFloat) -> CGPoint {
        switch arrow {
        case .up: return CGPoint(x: point.x, y: point.y + distance)
        case .down: return CGPoint(x: point.x, y: point.y - distance)
        case .left: return CGPoint(x: point.x - distance, y: point.y)
        case .right: return CGPoint(x: point.x + distance, y: point.y)
        }
    }

    private func place(_ view: NSView?, at center: CGPoint, size: CGSize? = nil) {
        guard let view else { return }
        let box = size ?? Self.fieldSize
        view.frame = CGRect(
            x: (center.x - box.width / 2).rounded(),
            y: (center.y - box.height / 2).rounded(),
            width: box.width,
            height: box.height
        )
    }

    // MARK: - Drawing

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        let plan = layoutPlan

        // Three layers, and the middle one is the setting: the container is
        // filled, the panes are filled over it, and what shows between them is
        // the space being edited. An outline alone left the padding the same
        // colour as the panel, which made the one thing the diagram exists to
        // show the one thing it did not.
        let frame = NSBezierPath(rect: plan.outerFrame.insetBy(dx: 0.5, dy: 0.5))
        palette.nsColor(.controlBackground).setFill()
        frame.fill()
        // Not `.border`: at this size the container's outline is the only thing
        // saying where the padding ends, and a hairline in the border colour
        // disappears into the panel behind it.
        palette.nsColor(.secondaryText).setStroke()
        frame.lineWidth = 1
        frame.stroke()

        let fill = palette.nsColor(.accent).withAlphaComponent(0.35)
        let border = palette.nsColor(.accent)
        for pane in plan.panes where pane.width > 0 && pane.height > 0 {
            let path = NSBezierPath(rect: pane.insetBy(dx: 0.5, dy: 0.5))
            fill.setFill()
            path.fill()
            border.setStroke()
            path.lineWidth = 1
            path.stroke()
        }
    }
}

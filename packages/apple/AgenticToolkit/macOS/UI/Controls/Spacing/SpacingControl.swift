import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A picture of the thing being spaced, with each number and its arrows sitting
/// on the edge — or the divider — they belong to.
///
/// Four text fields and a column of labels can say the same thing, but they
/// cannot say *which* edge is which without the reader building the picture in
/// their head. Here the diagram is the control.
///
/// Two flavors, chosen by `SpacingDiagram`:
/// - `.frame` — one view inside its container. Each of the four edges carries a
///   number straddling the line, with an arrow either side of it: the one
///   pointing out of the frame adds room, the one pointing into the view takes
///   it away.
/// - `.paneDividers` — four panes and the two dividers between them. Each
///   divider carries a number and two buttons whose glyphs are arrow *pairs*:
///   arrows converging on the line close the gap, arrows spreading apart open
///   it. A divider is shared by the panes either side of it, so ten points means
///   ten points of gap, not ten from each side — which is why the buttons close
///   and open a gap rather than moving an edge.
///
/// Both flavors come out the same size overall, so a panel showing one of each
/// gets two diagrams that line up.
///
/// The control knows nothing about settings or about what it is spacing. It
/// holds a `Spacing` and reports changes; wiring that to a setting, and
/// applying it to a window, is the caller's job (`separation-of-concerns`).
@MainActor
public final class SpacingControl: NSView, NSTextFieldDelegate {

    public typealias Style = SpacingDiagram

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

    /// The overall size of either control, and the diagram size of the pane
    /// flavor — which draws entirely inside itself. Wide enough that the two
    /// divider controls stay clear of each other: each sits in the middle of a
    /// different pane, and the room between those two middles is what this
    /// number buys.
    private static let controlSize = CGSize(width: 300, height: 170)
    private static let fieldSize = CGSize(width: 44, height: 21)
    private static let edgeArrowSize: CGFloat = 22
    /// Between a number and the arrow beside it.
    private static let arrowGap: CGFloat = 6
    /// How far the outward arrow is pushed past its edge, and the inward one
    /// pulled inside it. Small, but it is what makes the pair read as *out of
    /// the frame* and *into it* rather than as two arrows in a row.
    private static let arrowNudge: CGFloat = 5
    /// A divider button's glyph is a pair of arrows either side of a line, so it
    /// is twice as long as it is thick. The box is shaped like the glyph, and
    /// the *thickness* is what the layout spaces on.
    private static let gutterButtonLength: CGFloat = 40
    private static let gutterButtonThickness: CGFloat = 18
    private static let arrowSymbolPointSize: CGFloat = 14
    /// Every arrow sits on a rounded chip. Without it a bare glyph reads as part
    /// of the drawing rather than as a button — and these are the buttons the
    /// control exists for.
    private static let chipRadius: CGFloat = 5

    /// Room the frame flavor needs outside its diagram: a number straddling an
    /// edge hangs half its width past the frame, and the arrow beside it is
    /// nudged further out still. The wider of the two wins on each axis.
    private static let framePadding = CGSize(
        width: max(fieldSize.width / 2, edgeArrowSize / 2 + arrowNudge),
        height: max(fieldSize.height / 2, edgeArrowSize / 2 + arrowNudge)
    )

    private var padding: CGSize { style == .frame ? Self.framePadding : .zero }

    // MARK: - Subviews

    private enum ArrowAction {
        case edge(SpacingEdge, Int)
        case gutter(SpacingGutter, Int)
    }

    private enum FieldTarget {
        case edge(SpacingEdge)
        case gutter(SpacingGutter)
    }

    private var edgeFields: [SpacingEdge: NSTextField] = [:]
    private var gutterFields: [SpacingGutter: NSTextField] = [:]
    /// Per edge: the arrow that adds room and the arrow that takes it away.
    private var edgeButtons: [SpacingEdge: (more: NSButton, less: NSButton)] = [:]
    /// Per divider: the button that closes the gap and the button that opens it.
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

        switch style {
        case .frame: buildEdgeControls()
        case .paneDividers: buildDividerControls()
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
        NSSize(width: Self.controlSize.width, height: Self.controlSize.height)
    }

    // MARK: - Building

    private func buildEdgeControls() {
        for edge in SpacingEdge.allCases {
            let field = makeField(accessibility: "spacing.\(edge.rawValue)")
            field.toolTip = "\(edge.displayName) — points between the edge and what is inside it"
            fieldTargets[ObjectIdentifier(field)] = .edge(edge)
            edgeFields[edge] = field
            addSubview(field)

            let more = makeArrowButton(
                symbol: edge.outward.symbolName,
                accessibility: "spacing.edge.\(edge.rawValue).more",
                tooltip: "More \(edge.displayName.lowercased()) space"
            )
            let less = makeArrowButton(
                symbol: edge.inward.symbolName,
                accessibility: "spacing.edge.\(edge.rawValue).less",
                tooltip: "Less \(edge.displayName.lowercased()) space"
            )
            arrowActions[ObjectIdentifier(more)] = .edge(edge, 1)
            arrowActions[ObjectIdentifier(less)] = .edge(edge, -1)
            addSubview(more)
            addSubview(less)
            edgeButtons[edge] = (more, less)
        }
    }

    private func buildDividerControls() {
        for gutter in SpacingGutter.allCases {
            let field = makeField(accessibility: "spacing.\(gutter.rawValue)")
            field.toolTip = Self.gutterDescription(gutter)
            fieldTargets[ObjectIdentifier(field)] = .gutter(gutter)
            gutterFields[gutter] = field
            addSubview(field)

            let narrower = makeArrowButton(
                symbol: Self.gutterSymbol(gutter, narrower: true),
                accessibility: "spacing.gutter.\(gutter.rawValue).narrower",
                tooltip: "Narrower gap between \(gutter.displayName)"
            )
            let wider = makeArrowButton(
                symbol: Self.gutterSymbol(gutter, narrower: false),
                accessibility: "spacing.gutter.\(gutter.rawValue).wider",
                tooltip: "Wider gap between \(gutter.displayName)"
            )
            arrowActions[ObjectIdentifier(narrower)] = .gutter(gutter, -1)
            arrowActions[ObjectIdentifier(wider)] = .gutter(gutter, 1)
            addSubview(narrower)
            addSubview(wider)
            gutterButtons[gutter] = (narrower, wider)
        }
    }

    /// Arrows pointing at a line close the gap; arrows pointing away from it
    /// open the gap. The line in the symbol is the divider, which is why these
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
        // `scaleProportionallyDown` never scales *up*, so a bigger box on its
        // own buys nothing — the symbol has to be asked for at the size it is
        // meant to be drawn, and at the weight it is meant to be read at.
        let image = NSImage(systemSymbolName: symbol, accessibilityDescription: tooltip)?
            .withSymbolConfiguration(.init(pointSize: Self.arrowSymbolPointSize, weight: .semibold))
        let button = NSButton(image: image ?? NSImage(), target: self, action: #selector(arrowClicked(_:)))
        button.isBordered = false
        button.setButtonType(.momentaryChange)
        button.imageScaling = .scaleProportionallyDown
        button.toolTip = tooltip
        button.translatesAutoresizingMaskIntoConstraints = true
        button.wantsLayer = true
        button.layer?.cornerRadius = Self.chipRadius
        // Held down, an arrow repeats — a control that moves by one point is
        // otherwise a click per point.
        button.isContinuous = true
        button.setPeriodicDelay(0.45, interval: 0.06)
        button.observeTheme { button, palette in
            button.contentTintColor = palette.nsColor(.primaryText)
            button.layer?.backgroundColor = palette.nsColor(.controlBackground).cgColor
            button.layer?.borderColor = palette.nsColor(.border).cgColor
            button.layer?.borderWidth = 1
        }
        return button.accessibilityID(accessibility)
    }

    // MARK: - Actions

    @objc private func arrowClicked(_ sender: NSButton) {
        guard let action = arrowActions[ObjectIdentifier(sender)] else { return }
        switch action {
        case .edge(let edge, let delta):
            apply(value.adjusting(edge, by: delta, in: range))
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
            apply(value.adjusting(edge, by: delta, in: range))
        case .gutter(let gutter):
            apply(value.adjusting(gutter, by: delta, in: range))
        }
        // `sync` has already caught the field editor up — see `show`.
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
        for (edge, field) in edgeFields {
            show(value[edge], in: field)
        }
        for (gutter, field) in gutterFields {
            show(value[gutter], in: field)
        }
        needsLayout = true
        needsDisplay = true
    }

    /// A field being typed in keeps its text in the window's field editor, not
    /// in the field, so assigning the value alone leaves the old number on
    /// screen. Every arrow is that case: a borderless momentary button never
    /// takes focus, so whichever field the user last clicked in is still
    /// editing when the arrow changes its number — and the number is the whole
    /// point of pressing the arrow. So the editor is told too, whenever there
    /// is one.
    private func show(_ number: Int, in field: NSTextField) {
        field.integerValue = number
        guard let editor = field.currentEditor(), editor.string != field.stringValue else { return }
        editor.string = field.stringValue
        editor.selectedRange = NSRange(location: field.stringValue.count, length: 0)
    }

    private var diagramRect: CGRect {
        CGRect(
            x: padding.width,
            y: padding.height,
            width: Self.controlSize.width - padding.width * 2,
            height: Self.controlSize.height - padding.height * 2
        )
    }

    private var layoutPlan: SpacingControlLayout {
        SpacingControlLayout(diagram: diagramRect, spacing: value, style: style)
    }

    public override func layout() {
        super.layout()
        let plan = layoutPlan
        layoutEdgeControls(plan)
        layoutDividerControls(plan)
    }

    /// The number straddles the edge; one arrow stands either side of it along
    /// that edge, the *more* arrow nudged outward and the *less* arrow inward.
    /// All of it is pinned to the frame, which is the one rectangle that does
    /// not move as the numbers change — so an arrow held down never slides out
    /// from under the pointer.
    private func layoutEdgeControls(_ plan: SpacingControlLayout) {
        for (edge, field) in edgeFields {
            let centre = plan.position(of: edge)
            place(field, at: centre)
            guard let buttons = edgeButtons[edge] else { continue }
            let box = CGSize(width: Self.edgeArrowSize, height: Self.edgeArrowSize)
            if edge.isHorizontal {
                let along = Self.fieldSize.width / 2 + Self.arrowGap + Self.edgeArrowSize / 2
                // Up on the left, down on the right, on both horizontal edges —
                // so the top and bottom of the picture read the same way, and
                // each arrow is nudged the way it points. Which of the two grows
                // the edge is then said by the picture itself: the one that adds
                // room is the one standing outside the frame line.
                let (left, right) = edge == .top ? (buttons.more, buttons.less) : (buttons.less, buttons.more)
                place(left, at: CGPoint(x: centre.x - along, y: centre.y + Self.arrowNudge), size: box)
                place(right, at: CGPoint(x: centre.x + along, y: centre.y - Self.arrowNudge), size: box)
            } else {
                let along = Self.fieldSize.height / 2 + Self.arrowGap + Self.edgeArrowSize / 2
                let out = edge == .leading ? -Self.arrowNudge : Self.arrowNudge
                place(buttons.more, at: CGPoint(x: centre.x + out, y: centre.y + along), size: box)
                place(buttons.less, at: CGPoint(x: centre.x - out, y: centre.y - along), size: box)
            }
        }
    }

    /// The number sits on the divider, in the middle of the panes it separates;
    /// the two buttons flank it *along* the divider — close first, open second,
    /// reading down the column divider and across the row divider.
    private func layoutDividerControls(_ plan: SpacingControlLayout) {
        for (gutter, field) in gutterFields {
            let centre = plan.position(of: gutter)
            place(field, at: centre)
            guard let buttons = gutterButtons[gutter] else { continue }
            let step = gutterButtonOffset(for: gutter)
            let box = gutterBox(for: gutter)
            switch gutter {
            case .betweenColumns:
                place(buttons.narrower, at: CGPoint(x: centre.x, y: centre.y + step), size: box)
                place(buttons.wider, at: CGPoint(x: centre.x, y: centre.y - step), size: box)
            case .betweenRows:
                place(buttons.narrower, at: CGPoint(x: centre.x - step, y: centre.y), size: box)
                place(buttons.wider, at: CGPoint(x: centre.x + step, y: centre.y), size: box)
            }
        }
    }

    /// Shaped like the glyph in it: the column pair points across, the row pair
    /// points up and down.
    private func gutterBox(for gutter: SpacingGutter) -> CGSize {
        switch gutter {
        case .betweenColumns:
            return CGSize(width: Self.gutterButtonLength, height: Self.gutterButtonThickness)
        case .betweenRows:
            return CGSize(width: Self.gutterButtonThickness, height: Self.gutterButtonLength)
        }
    }

    /// Far enough from the field that the two do not touch. The column pair
    /// stacks above and below it, so it clears the field's height; the row pair
    /// sits either side, so it clears the width. Either way it is the button's
    /// *thickness* that stacks against the field, never its length.
    private func gutterButtonOffset(for gutter: SpacingGutter) -> CGFloat {
        let extent = gutter == .betweenColumns ? Self.fieldSize.height : Self.fieldSize.width
        return extent / 2 + Self.gutterButtonThickness / 2 + Self.arrowGap / 2
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

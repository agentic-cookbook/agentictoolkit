import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A picture of the thing being spaced: the arrows stand on the line they move,
/// and each number sits outside the frame, in line with the arrows that change
/// it.
///
/// Four text fields and a column of labels can say the same thing, but they
/// cannot say *which* edge is which without the reader building the picture in
/// their head. Here the diagram is the control.
///
/// The number is outside because the line belongs to the arrows. They are
/// attached to it and travel with it, and a number sharing that line pushed all
/// three along the edge and away from the middle of it. Out beyond the frame the
/// number holds still and is centred on the side it names, which is what a label
/// on an edge should do.
///
/// **Every arrow stands against the line it moves, and points the way that line
/// travels** — `->|` and `|<-`. So the arrow that adds room at an edge is the
/// one pointing *into* the view: growing the top inset is what sends the view's
/// top edge down. Reading it the other way round — an arrow pointing out of the
/// frame to add room — puts the arrow and the line it moves in opposite
/// directions, which is exactly the thing a picture is here to avoid.
///
/// Two flavors, chosen by `SpacingDiagram`, and they are the *same* control:
/// same size, same inset, same chips, same code — only the diagram inside
/// differs, so a panel showing one of each gets two pictures that line up and
/// behave alike.
/// - `.frame` — one view inside its container. Each of the four edges of the
///   view carries two arrows meeting tip to tip on the line, and a number
///   beyond the container, centred on that edge.
/// - `.paneDividers` — four panes and the two dividers between them. A divider
///   has two edges, one per pane, so it carries **four** arrows: a pair closing
///   the gap, a pair opening it, each arrow against the pane edge it moves. A
///   divider is shared by the panes either side of it, so ten points means ten
///   points of gap, not ten from each side — which is why both arrows of a pair
///   change the same number.
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

    /// The diagram's geometry, which lives with the rules that use it.
    private typealias Metrics = SpacingControlLayout

    /// The overall size of **both** flavors. Wide enough that the two divider
    /// controls stay clear of each other: each sits in the middle of a
    /// different pane, and the room between those two middles is what this
    /// number buys. Wider and taller than it was, so the diagram keeps its
    /// proportions now that a ring of numbers stands outside it.
    private static let controlSize = CGSize(width: 420, height: 250)

    private static let arrowSymbolPointSize: CGFloat = 20
    /// Every arrow sits on a rounded chip. Without it a bare glyph reads as part
    /// of the drawing rather than as a button — and these are the buttons the
    /// control exists for.
    private static let chipRadius: CGFloat = 5

    /// Room outside the diagram for what hangs off it — the same on both
    /// flavors, so the two draw the same rectangle in the same place.
    ///
    /// At zero spacing an arrow standing outside an edge reaches a full arrow
    /// length past the frame line, and the number stands beyond that again.
    /// Adding those up is ``SpacingControlLayout/chrome``'s job, since it is
    /// what places them.
    private static let diagramInset = Metrics.chrome

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
    /// Per divider: the two arrows that close the gap and the two that open it,
    /// one of each standing against each of the panes either side.
    ///
    /// A single button carrying a *pair* of arrows on one glyph said the same
    /// thing in half the buttons, but it was one control touching neither edge.
    /// These touch the edges they move.
    private var gutterButtons: [SpacingGutter: GutterArrows] = [:]

    /// `near` is the pane before the divider — the left one, or the lower one;
    /// `far` is the one after it.
    private struct GutterArrows {
        let narrowerNear: NSButton
        let narrowerFar: NSButton
        let widerNear: NSButton
        let widerFar: NSButton
    }

    private var arrowActions: [ObjectIdentifier: ArrowAction] = [:]
    /// Which way each arrow points — the one fact its placement and its box are
    /// both derived from, so neither can disagree with the glyph.
    private var arrowDirections: [ObjectIdentifier: SpacingArrow] = [:]
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
                arrow: edge.growing,
                accessibility: "spacing.edge.\(edge.rawValue).more",
                tooltip: "More \(edge.displayName.lowercased()) space"
            )
            let less = makeArrowButton(
                arrow: edge.shrinking,
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

            func arrow(near: Bool, narrower: Bool) -> NSButton {
                let button = makeArrowButton(
                    arrow: Self.gutterArrow(gutter, near: near, narrower: narrower),
                    accessibility: "spacing.gutter.\(gutter.rawValue)"
                        + ".\(narrower ? "narrower" : "wider").\(near ? "near" : "far")",
                    tooltip: "\(narrower ? "Narrower" : "Wider") gap between \(gutter.displayName)"
                )
                arrowActions[ObjectIdentifier(button)] = .gutter(gutter, narrower ? -1 : 1)
                addSubview(button)
                return button
            }

            gutterButtons[gutter] = GutterArrows(
                narrowerNear: arrow(near: true, narrower: true),
                narrowerFar: arrow(near: false, narrower: true),
                widerNear: arrow(near: true, narrower: false),
                widerFar: arrow(near: false, narrower: false)
            )
        }
    }

    /// Which way one of a divider's four arrows points: the way the pane edge
    /// it stands against travels.
    ///
    /// Closing the gap brings both edges towards the divider and opening it
    /// takes them both away, so the near arrow and the far arrow of a pair
    /// point at each other or away from each other — which is what makes the
    /// pair read as *close* or *open* without a label on it.
    private static func gutterArrow(_ gutter: SpacingGutter, near: Bool, narrower: Bool) -> SpacingArrow {
        switch gutter {
        case .betweenColumns: return near == narrower ? .right : .left
        case .betweenRows: return near == narrower ? .up : .down
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

    /// The button is placed in `layout()`, so the caller passes only what the
    /// button *is* and which way it points — never where it goes.
    private func makeArrowButton(arrow: SpacingArrow, accessibility: String, tooltip: String) -> NSButton {
        // `scaleProportionallyDown` never scales *up*, so a bigger box on its
        // own buys nothing — the symbol has to be asked for at the size it is
        // meant to be drawn, and at the weight it is meant to be read at.
        let image = NSImage(systemSymbolName: arrow.symbolName, accessibilityDescription: tooltip)?
            .withSymbolConfiguration(.init(pointSize: Self.arrowSymbolPointSize, weight: .bold))
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
        arrowDirections[ObjectIdentifier(button)] = arrow
        return button.accessibilityID(accessibility)
    }

    /// The box an arrow is drawn in: shaped like the glyph on it, so a row of
    /// arrows takes only the room the arrows need.
    private func box(of button: NSButton) -> CGSize {
        guard let arrow = arrowDirections[ObjectIdentifier(button)], arrow.isHorizontal else {
            return CGSize(width: Metrics.arrowBreadth, height: Metrics.arrowLength)
        }
        return CGSize(width: Metrics.arrowLength, height: Metrics.arrowBreadth)
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
        sync(forcing: field)
    }

    private func apply(_ newValue: Spacing) {
        guard newValue != value else { return }
        value = newValue
        onChange?(newValue)
    }

    // MARK: - Sync and layout

    /// `forced` is the field whose text has just been committed: it is shown
    /// again even when its number did not change, because a typed value that
    /// was clamped back to the number already held is the one case where the
    /// text on screen and the value disagree without the value moving.
    private func sync(forcing forced: NSTextField? = nil) {
        for (edge, field) in edgeFields {
            show(value[edge], in: field, force: field === forced)
        }
        for (gutter, field) in gutterFields {
            show(value[gutter], in: field, force: field === forced)
        }
        needsLayout = true
        needsDisplay = true
    }

    /// The number each field was last shown, so `show` can tell "this field's
    /// value changed" from "some other field's did". `field.integerValue` cannot
    /// answer that: while a field is being edited it reports what is in the
    /// field editor, which is whatever the user has typed so far.
    private var shownNumbers: [ObjectIdentifier: Int] = [:]

    /// A field being typed in keeps its text in the window's field editor, not
    /// in the field, so assigning the value alone leaves the old number on
    /// screen. Every arrow is that case: a borderless momentary button never
    /// takes focus, so whichever field the user last clicked in is still
    /// editing when the arrow changes its number — and the number is the whole
    /// point of pressing the arrow. So the editor is told too, whenever there
    /// is one.
    ///
    /// **Only when this field's own number moved.** One arrow press re-shows
    /// all six fields, and writing the editor of a field whose number did not
    /// change would throw away what the user is halfway through typing in it —
    /// click into Top, type `1`, press Left's arrow, and the `1` is gone.
    private func show(_ number: Int, in field: NSTextField, force: Bool = false) {
        let id = ObjectIdentifier(field)
        let moved = shownNumbers[id] != number
        shownNumbers[id] = number
        guard let editor = field.currentEditor() else {
            field.integerValue = number
            return
        }
        guard moved || force else { return }
        field.integerValue = number
        guard editor.string != field.stringValue else { return }
        editor.string = field.stringValue
        editor.selectedRange = NSRange(location: field.stringValue.count, length: 0)
    }

    /// Below this the picture stops being readable and the arrows start to
    /// overlap; the control clips rather than shrinking further, which is a
    /// legible failure instead of an illegible one.
    private static let minimumSize = CGSize(
        width: diagramInset.width * 2 + Metrics.fieldSize.width * 3,
        height: diagramInset.height * 2 + Metrics.fieldSize.height * 3
    )

    /// Measured from `bounds`, not from `controlSize`.
    ///
    /// `intrinsicContentSize` *asks* for `controlSize`, but asking is all it
    /// does: a settings panel pins its content to the panel width with a
    /// required constraint, and default compression resistance loses to that.
    /// A diagram drawn to a box wider than `bounds` puts the right-hand number
    /// and its arrows outside the view, where `hitTest` refuses them — so they
    /// are not merely clipped, they cannot be clicked at all, and a pinned
    /// scroll view means there is no scrolling to them either. A slightly
    /// smaller picture is the better failure.
    private var diagramRect: CGRect {
        let size = CGSize(
            width: max(bounds.width, Self.minimumSize.width),
            height: max(bounds.height, Self.minimumSize.height)
        )
        return CGRect(
            x: Self.diagramInset.width,
            y: Self.diagramInset.height,
            width: size.width - Self.diagramInset.width * 2,
            height: size.height - Self.diagramInset.height * 2
        )
    }

    private var layoutPlan: SpacingControlLayout {
        SpacingControlLayout(diagram: diagramRect, spacing: value, style: style)
    }

    /// The diagram is measured from `bounds`, so a resize moves every subview
    /// and repaints the drawing under them.
    public override func setFrameSize(_ newSize: NSSize) {
        super.setFrameSize(newSize)
        needsLayout = true
        needsDisplay = true
    }

    public override func layout() {
        super.layout()
        let plan = layoutPlan
        layoutEdgeControls(plan)
        layoutDividerControls(plan)
    }

    /// One step out from a line, along the axis an arrow points: half an arrow,
    /// so the arrow's tip lands exactly on the line.
    private static let attachment: CGFloat = Metrics.arrowLength / 2

    /// Where an arrow's centre goes if its **tip** is to touch `line` on the
    /// cross axis: half an arrow back along the way it points, which puts the
    /// body on the far side from where it is aimed — `->|`.
    private func attached(_ arrow: SpacingArrow, to centre: CGPoint) -> CGPoint {
        switch arrow {
        case .up: return CGPoint(x: centre.x, y: centre.y - Self.attachment)
        case .down: return CGPoint(x: centre.x, y: centre.y + Self.attachment)
        case .left: return CGPoint(x: centre.x + Self.attachment, y: centre.y)
        case .right: return CGPoint(x: centre.x - Self.attachment, y: centre.y)
        }
    }

    /// Between a divider's two pairs of arrows, from the divider's centre to
    /// each pair: half an arrow's breadth and half the gap, so the closing pair
    /// and the opening pair stand clear of each other with nothing between them.
    /// There used to be a number there, and this is what shrank when it moved
    /// outside.
    private static let pairOffset: CGFloat = (Metrics.arrowBreadth + Metrics.arrowGap) / 2

    /// Both of an edge's arrows sit on the middle of that edge of the **view**,
    /// tips meeting on the line and bodies on opposite sides of it — `->| |<-`.
    /// Press one and the line moves the way it is aimed. The number stands out
    /// beyond the container, centred on the same edge.
    private func layoutEdgeControls(_ plan: SpacingControlLayout) {
        for (edge, field) in edgeFields {
            place(field, at: plan.fieldPosition(of: edge))
            guard let buttons = edgeButtons[edge] else { continue }
            let line = plan.position(of: edge)
            for (button, arrow) in [(buttons.more, edge.growing), (buttons.less, edge.shrinking)] {
                place(button, at: attached(arrow, to: line), size: box(of: button))
            }
        }
    }

    /// A divider has two edges, one per pane, so it carries two *pairs* of
    /// arrows: the closing pair one way along the divider, the opening pair the
    /// other, straddling the middle of the panes they separate. Each arrow
    /// stands against its own pane's edge, outside the gutter — there is no room
    /// to stand one inside a gap that is a hairline at zero, so the opening pair
    /// is drawn from the outside too. The number stands outside the container,
    /// in line with the divider.
    private func layoutDividerControls(_ plan: SpacingControlLayout) {
        for (gutter, field) in gutterFields {
            let centre = plan.position(of: gutter)
            place(field, at: plan.fieldPosition(of: gutter))
            guard let buttons = gutterButtons[gutter] else { continue }
            let across = gutter == .betweenColumns ? plan.columnGutter : plan.rowGutter
            let along = Self.pairOffset
            let pairs = [(-along, buttons.widerNear, buttons.widerFar),
                         (along, buttons.narrowerNear, buttons.narrowerFar)]
            for (offset, near, far) in pairs {
                for (button, isNear) in [(near, true), (far, false)] {
                    let seat = Self.gutterSeat(
                        gutter, on: centre, in: across, along: offset, near: isNear
                    )
                    place(button, at: seat, size: box(of: button))
                }
            }
        }
    }

    /// One of a divider's four arrow seats: `along` picks the pair (the closing
    /// pair sits above the number on the column divider and to its left on the
    /// row divider), `near` picks which side of the gutter.
    private static func gutterSeat(
        _ gutter: SpacingGutter,
        on centre: CGPoint,
        in across: CGRect,
        along: CGFloat,
        near: Bool
    ) -> CGPoint {
        switch gutter {
        case .betweenColumns:
            let side = near
                ? across.minX - attachment
                : across.maxX + attachment
            return CGPoint(x: side, y: centre.y + along)
        case .betweenRows:
            let side = near
                ? across.minY - attachment
                : across.maxY + attachment
            return CGPoint(x: centre.x - along, y: side)
        }
    }

    private func place(_ view: NSView?, at center: CGPoint, size: CGSize? = nil) {
        guard let view else { return }
        let box = size ?? Metrics.fieldSize
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

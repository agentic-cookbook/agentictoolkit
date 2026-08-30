import AgenticToolkitCore
import AgenticToolkitCoreMacOS
import AppKit

/// A titled card that folds: a rounded surface, a one-line masthead, and
/// whatever content is added to it.
///
///     ┌───────────────────────────────────────────🛑─┐
///     │ mike@example.com                           ▾ │
///     │ …content…                                    │
///     └──────────────────────────────────────────────┘
///
///     ┌───────────────────────────────────────────🛑─┐
///     │ me@example.com        5H: 23% | 7D: 12%    ▸ │
///     └──────────────────────────────────────────────┘
///
/// A card that folds is what makes a list of five sections readable on a laptop
/// screen: the cards a reader is not watching cost one line each instead of
/// four, and a content-hugging window shrinks to the smaller content. The
/// collapsed line still has to answer the question the card exists to answer, so
/// it keeps a summary of what it is hiding — a fold that hides the numbers is
/// just a card you have to open again.
///
/// The folded summary is pinned to the right, not parked after the title:
/// stacked cards then read as a column of readings under one right edge instead
/// of each line starting wherever its own title happened to stop.
///
/// ## The standing is a corner badge, not a masthead item
///
/// A card's status is stamped on its top-right corner — centred on the corner's
/// own curve, half of it hanging off the card — rather than set in the masthead
/// beside the toggle.
/// On the line it cost every card a reserved slot — a card with nothing to
/// report still had to hold the width of the widest symbol the host could draw,
/// or the summaries either side of it stopped lining up — and it spent that
/// width on the cards that had the least to say. On the corner it costs no card
/// anything, it is found without reading the line it is on, and it can be drawn
/// big enough to read across a list. It reaches no further into the card than
/// its own radius, which is less than the gutter the masthead is already held
/// off the edge by: that is what keeps it clear of the disclosure triangle
/// without either knowing about the other.
///
/// It is centred on the *visible* corner, not on the frame's: a rounded card has
/// no ink at the square corner, so a badge centred there sits up and out on air
/// and reads as having slipped off. `cornerPeakInset` walks it back down and in
/// to the point where the corner arc actually turns — the 45° point on it, which
/// is `r - r/√2` inside the frame on each axis.
///
/// The card's surface and border are drawn by a subview rather than by the card
/// itself, purely so the badge can be drawn over them. A `CALayer` paints its own
/// border ABOVE its sublayers, so a card that draws its own border draws a
/// hairline straight across a badge sitting on its corner, whatever the badge's
/// `zPosition` says — the only fix is for the border to belong to a layer the
/// badge is not inside.
///
/// ## The title gets whatever the masthead is not using
///
/// The title is the one thing on that line that yields, so it is the one thing
/// that goes short when the line is full. An open card's summary is not drawn,
/// so its well leaves the layout and the title has the whole line; what the
/// summary WILL need when the card folds is reserved on the card's width floor
/// (`mastheadWidthFloor`) instead, where it does not eat a line nothing is
/// written on. That is what keeps a long address whole while folding still moves
/// nothing sideways.
///
/// The floor counts the title itself as well, so a card with a summary is wide
/// enough to write both: yielding is what the title does when the window is too
/// narrow for it, not something a card should ask of it while there is a window
/// still willing to grow.
///
/// ## Folding never changes the card's width
///
/// A card is exactly as wide folded as it is open, and that is the whole reason
/// its content is built even while it is shut. A window that hugs its content
/// derives its width from the widest thing in it; if a fold dropped the content
/// out of the layout, every fold would re-derive a narrower window and the
/// window would jump sideways under the reader on a click that was about
/// height. So the content is added to the card in both states and merely
/// *hidden* when folded, and the card carries a width floor measured from it
/// (`contentWidthFloor`), which the collapsed summary's reserved slot matches on
/// the header side. Height is the only thing a fold is allowed to move.
///
/// The host still gets to skip the *work* a hidden card would otherwise cause —
/// registering a live countdown, subscribing to a feed — because it knows which
/// cards are folded (`CardFoldMemory.isCollapsed`); what it must not skip is
/// building the views, which is what makes the width knowable.
@MainActor
public final class DisclosureCardView: NSView, Themeable {

    /// One reading on a collapsed card's summary line: `5H: 23%`. Kept as parts
    /// rather than a formatted string so each value can carry its own colour — a
    /// fold that greys out a red 97% hides exactly the fact it most needed to
    /// keep.
    public struct SummaryPart {
        public let name: String
        public let value: String
        /// How the value is coloured, asked of the live palette rather than
        /// resolved once when the part is built — so a card already on screen
        /// recolours with everything else when the theme changes. A closure
        /// rather than a colour name because a host may colour by something the
        /// palette's name table cannot say (a position in a series, say), and
        /// the card has no business knowing which.
        public let color: (SemanticPalette) -> NSColor?

        public init(
            name: String, value: String, color: @escaping (SemanticPalette) -> NSColor?
        ) {
            self.name = name
            self.value = value
            self.color = color
        }

        /// The common case: a colour the palette already knows by name.
        public init(name: String, value: String, colorName: String?) {
            self.init(name: name, value: value, color: { $0.color(named: colorName) })
        }
    }

    /// What a card says about its own standing, drawn on the card's top-right
    /// corner. `accessibilityLabel` is also the tooltip: a symbol is compact,
    /// not self-explaining, and the word it replaced has to stay reachable
    /// somewhere.
    public struct StatusSymbol {
        public let symbolName: String
        public let colorName: String?
        public let accessibilityLabel: String

        public init(symbolName: String, colorName: String?, accessibilityLabel: String) {
            self.symbolName = symbolName
            self.colorName = colorName
            self.accessibilityLabel = accessibilityLabel
        }
    }

    private let titleField = NSTextField(labelWithString: "")
    /// One quiet line under the masthead saying what the card's content means.
    private let subtitleField = NSTextField(labelWithString: "")
    /// The collapsed card's one-line stand-in for its content.
    private let summaryField = NSTextField(labelWithString: "")
    /// The well the summary sits in, kept at the summary's width in BOTH states
    /// so the masthead is the same width folded and open (see the width note in
    /// the type's documentation). Empty and invisible when the card is open.
    private let summarySlot = NSView()
    /// The card's surface and border, drawn by a view of its own so the corner
    /// badge can sit above them — see the note in the type's documentation.
    private let surface = NSView()
    private let statusIcon = NSImageView()
    private let disclosure = NSButton()
    private let content = NSStackView()

    /// Accent (an identifier, an address) vs. primary text (a plain heading).
    private let titleIsAccent: Bool
    private let summary: [SummaryPart]
    private let status: StatusSymbol?
    private let scaledSize: CGFloat
    private let onToggle: ((Bool) -> Void)?

    private var observer: ThemePaletteObserver?

    /// Width of the reserved summary well, re-measured whenever the palette
    /// (and so the summary's fonts) changes.
    private var summarySlotWidth: NSLayoutConstraint?
    /// The card's fold-independent width floor: as wide as its content wants to
    /// be, whether or not the content is currently drawn.
    private var contentWidthFloor: NSLayoutConstraint?
    /// What the masthead needs when this card is FOLDED — its title, its
    /// summary, the toggle, and the gaps between them. Held on the width floor
    /// instead of in the open card's layout, so folding cannot change the card's
    /// width and an open title still gets the room the summary is not using.
    private var mastheadWidthFloor: CGFloat = 0

    private static let cornerRadius: CGFloat = 10
    private static let borderWidth: CGFloat = 1
    private static let horizontalInset: CGFloat = 14
    private static let verticalInset: CGFloat = 12
    /// How far a dimmed card recedes. Far enough to sort one card out of a list
    /// at a glance, not so far that the dimmed cards stop being readable.
    private static let dimmedAlpha: CGFloat = 0.55
    /// The masthead's own spacings, named once because the folded width floor
    /// has to add up the same line the layout builds.
    private static let mastheadGap: CGFloat = 8
    private static let trailingSpacing: CGFloat = 6

    private let padX: CGFloat
    private let padY: CGFloat

    public init(
        title: String,
        titleIsAccent: Bool,
        subtitle: String? = nil,
        summary: [SummaryPart] = [],
        status: StatusSymbol? = nil,
        isCollapsed: Bool = false,
        isDimmed: Bool = false,
        scaledSize: CGFloat,
        onToggle: ((Bool) -> Void)? = nil
    ) {
        self.titleIsAccent = titleIsAccent
        self.summary = summary
        self.status = status
        self.scaledSize = scaledSize
        self.onToggle = onToggle
        self.padX = Self.padXFor(scaledSize: scaledSize)
        self.padY = ceil(Self.verticalInset * scaledSize / CGFloat(NSFont.systemFontSize))
        super.init(frame: .zero)
        // Whole-card alpha rather than a second set of dimmed colours: the card
        // recedes complete — border, surface, content and all — and every colour
        // it draws keeps meaning exactly what it means on the live card.
        alphaValue = isDimmed ? Self.dimmedAlpha : 1.0
        translatesAutoresizingMaskIntoConstraints = false
        // The corner badge is drawn half outside the card on purpose.
        clipsToBounds = false
        surface.wantsLayer = true
        surface.translatesAutoresizingMaskIntoConstraints = false

        titleField.stringValue = title
        titleField.translatesAutoresizingMaskIntoConstraints = false
        titleField.lineBreakMode = .byTruncatingMiddle
        // The title yields before anything else on the line: a truncated address
        // is still recognisable, and a truncated percentage is a lie.
        titleField.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        titleField.setContentHuggingPriority(.defaultLow, for: .horizontal)

        subtitleField.stringValue = subtitle ?? ""
        subtitleField.translatesAutoresizingMaskIntoConstraints = false
        subtitleField.lineBreakMode = .byTruncatingTail
        // The subtitle explains, it does not measure: it yields its width to the
        // card's content rather than widening the window to stay whole.
        subtitleField.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        // A folded card is a headline; the explanation belongs to the content it
        // is currently hiding, and reprinting it under a one-line card doubles
        // the height the fold was asked to reclaim.
        subtitleField.isHidden = subtitle == nil || isCollapsed

        configureSummarySlot(isCollapsed: isCollapsed)
        configureStatusBadge()
        configureDisclosure(isCollapsed: isCollapsed)

        content.orientation = .vertical
        content.alignment = .width
        content.spacing = 12
        content.translatesAutoresizingMaskIntoConstraints = false
        content.isHidden = isCollapsed

        // The title at the left edge, the folded card's summary and the toggle
        // at the right. The toggle is the one piece every card has, so it lands
        // in the same place on all of them; the summary sits just inside it, in
        // a well of its own width, so folded cards read as a column of readings
        // under one right edge.
        let trailing = NSStackView(views: [summarySlot, disclosure])
        trailing.orientation = .horizontal
        trailing.alignment = .centerY
        trailing.spacing = Self.trailingSpacing
        trailing.translatesAutoresizingMaskIntoConstraints = false

        let header = PinnedEndsLine.make(
            leading: titleField, trailing: trailing,
            minimumGap: Self.mastheadGap, alignment: .centerY
        )

        // Title and subtitle are one masthead, tight together, so the card's own
        // content spacing separates the masthead from the content rather than the
        // title from its own explanation.
        let masthead = NSStackView()
        masthead.orientation = .vertical
        masthead.spacing = 2
        masthead.translatesAutoresizingMaskIntoConstraints = false
        masthead.addFullWidthArrangedSubview(header)
        masthead.addFullWidthArrangedSubview(subtitleField)

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .width
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.addFullWidthArrangedSubview(masthead)
        // Hidden rather than left out: an `NSStackView` detaches a hidden
        // arranged view completely, so a folded card is one line tall with no
        // stray spacing under it — and, unlike leaving the content out, the card
        // can still be measured at the width it will want when it opens.
        stack.addFullWidthArrangedSubview(content)
        // Order is what puts the badge over the border: the surface first, the
        // content on it, the badge last and so above both.
        addSubview(surface)
        addSubview(stack)
        addSubview(statusIcon)

        let floor = widthAnchor.constraint(greaterThanOrEqualToConstant: 0)
        // Just under required: on a screen too narrow for the content the window
        // scrolls rather than the layout becoming unsatisfiable.
        floor.priority = NSLayoutConstraint.Priority(999)
        contentWidthFloor = floor

        // Centred ON the corner rather than tucked inside it: half of the badge
        // hangs off the card, which is what makes it read as a stamp on the card
        // rather than as something the card is making room for. It reaches no
        // further in than its own radius, and that is less than the gutter the
        // masthead is already held off the edge by, so it cannot touch the
        // toggle however large a text size asks for.
        let badge = Self.cornerBadgeDiameter(scaledSize: scaledSize)
        let peak = Self.cornerPeakInset
        NSLayoutConstraint.activate([
            surface.topAnchor.constraint(equalTo: topAnchor),
            surface.bottomAnchor.constraint(equalTo: bottomAnchor),
            surface.leadingAnchor.constraint(equalTo: leadingAnchor),
            surface.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.topAnchor.constraint(equalTo: topAnchor, constant: padY),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -padY),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: padX),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -padX),
            statusIcon.centerXAnchor.constraint(equalTo: trailingAnchor, constant: -peak),
            statusIcon.centerYAnchor.constraint(equalTo: topAnchor, constant: peak),
            statusIcon.widthAnchor.constraint(equalToConstant: badge),
            statusIcon.heightAnchor.constraint(equalToConstant: badge),
            floor
        ])

        observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    /// The summary's well, at the summary's own width. Present only when there
    /// is a summary AND the card is folded — what keeps the fold from moving
    /// anything sideways is the width floor (`mastheadWidthFloor`), not a well
    /// standing empty on a line the title needs.
    private func configureSummarySlot(isCollapsed: Bool) {
        summaryField.translatesAutoresizingMaskIntoConstraints = false
        summaryField.alignment = .right
        summaryField.lineBreakMode = .byClipping
        summaryField.setContentCompressionResistancePriority(.required, for: .horizontal)
        summaryField.setContentHuggingPriority(.required, for: .horizontal)
        summarySlot.translatesAutoresizingMaskIntoConstraints = false
        // An `NSStackView` detaches a hidden arranged view completely, which is
        // the point: an open card's title gets the whole line.
        summarySlot.isHidden = summary.isEmpty || !isCollapsed
        summarySlot.addSubview(summaryField)
        let width = summarySlot.widthAnchor.constraint(equalToConstant: 0)
        summarySlotWidth = width
        NSLayoutConstraint.activate([
            summaryField.trailingAnchor.constraint(equalTo: summarySlot.trailingAnchor),
            summaryField.leadingAnchor.constraint(greaterThanOrEqualTo: summarySlot.leadingAnchor),
            summaryField.topAnchor.constraint(equalTo: summarySlot.topAnchor),
            summaryField.bottomAnchor.constraint(equalTo: summarySlot.bottomAnchor),
            width
        ])
    }

    /// The corner badge: this card's standing, on its top-right corner, or
    /// nothing at all. A card with nothing to report draws nothing and pays
    /// nothing — there is no slot to keep open, because the badge shares its
    /// line with nothing.
    private func configureStatusBadge() {
        statusIcon.translatesAutoresizingMaskIntoConstraints = false
        statusIcon.imageScaling = .scaleProportionallyDown
        statusIcon.isHidden = status == nil
        guard let status else { return }
        statusIcon.image = NSImage(
            systemSymbolName: status.symbolName,
            accessibilityDescription: status.accessibilityLabel
        )
        statusIcon.symbolConfiguration = Self.statusSymbolConfiguration(scaledSize: scaledSize)
        statusIcon.toolTip = status.accessibilityLabel
        // Its own element, because it is no longer inside a line a reader is
        // handed anyway: unspoken, a corner mark is invisible rather than terse.
        statusIcon.setAccessibilityElement(true)
        statusIcon.setAccessibilityRole(.image)
        statusIcon.setAccessibilityLabel(status.accessibilityLabel)
    }

    /// How big the corner badge is drawn. Bigger than the text beside it: it is
    /// the one mark on a card that has to be legible from across a list of them,
    /// and it is not competing for room with anything — it sits in the corner's
    /// own air. Bounded by the gutter all the same, since half of it hangs
    /// inside the card and must stay clear of the toggle.
    static func cornerBadgeDiameter(scaledSize: CGFloat) -> CGFloat {
        min(ceil(scaledSize * 1.3), padXFor(scaledSize: scaledSize) * 1.5)
    }

    /// How far inside the frame's corner the rounded corner's curve actually
    /// peaks: the 45° point on an arc of radius `r` lies `r - r/√2` in on each
    /// axis. What the badge is centred on, since the square corner it would
    /// otherwise take is a place the card draws nothing.
    static let cornerPeakInset: CGFloat = cornerRadius - cornerRadius / 2.0.squareRoot()

    /// The card's horizontal gutter, as a function of the text size — the same
    /// arithmetic `padX` is built from, available before there is an instance
    /// to ask.
    private static func padXFor(scaledSize: CGFloat) -> CGFloat {
        ceil(Self.horizontalInset * scaledSize / CGFloat(NSFont.systemFontSize))
    }

    private static func statusSymbolConfiguration(
        scaledSize: CGFloat
    ) -> NSImage.SymbolConfiguration {
        NSImage.SymbolConfiguration(
            pointSize: Self.cornerBadgeDiameter(scaledSize: scaledSize), weight: .semibold
        )
    }

    /// The system disclosure triangle rather than a drawn chevron: it is the
    /// control macOS already uses for exactly this, it points the way every
    /// other folding thing on the platform points, and it comes with the
    /// keyboard and accessibility behaviour for free.
    private func configureDisclosure(isCollapsed: Bool) {
        disclosure.translatesAutoresizingMaskIntoConstraints = false
        disclosure.bezelStyle = .disclosure
        disclosure.setButtonType(.onOff)
        disclosure.title = ""
        disclosure.state = isCollapsed ? .off : .on
        disclosure.setContentCompressionResistancePriority(.required, for: .horizontal)
        disclosure.target = self
        disclosure.action = #selector(disclosureTapped)
        disclosure.toolTip = isCollapsed ? "Show details" : "Hide details"
        disclosure.setAccessibilityLabel(isCollapsed ? "Show details" : "Hide details")
    }

    @objc private func disclosureTapped() {
        onToggle?(disclosure.state == .off)
    }

    /// Appends a view below the masthead. Called whether or not the card is
    /// folded — see the width note in the type's documentation.
    public func addContent(_ view: NSView) {
        content.addFullWidthArrangedSubview(view)
        updateContentWidthFloor()
    }

    /// Spacing between the card's own content views. Some content wants air
    /// between its pieces; a table's rows want to read as a table.
    public var contentSpacing: CGFloat {
        get { content.spacing }
        set {
            content.spacing = newValue
            updateContentWidthFloor()
        }
    }

    /// Whether this card is currently folded. Set at build time; a fold is
    /// applied by rebuilding, not by mutating.
    public var isCollapsed: Bool { content.isHidden }

    /// The width the card wants for its content, drawn or not. Re-measured on
    /// every layout pass so a font change (a theme swap, the text-size slider)
    /// that resizes the hidden content is picked up too; the guard is what stops
    /// a measurement made during layout from asking for another one forever.
    public override func layout() {
        super.layout()
        updateContentWidthFloor()
    }

    private func updateContentWidthFloor() {
        guard let contentWidthFloor else { return }
        // The wider of the two things a fold swaps between: the content the open
        // card draws, and the masthead the folded one draws instead. Both are
        // measured in whichever state the card is in, which is what makes the
        // floor fold-independent.
        let wanted = max(ceil(content.fittingSize.width), mastheadWidthFloor) + padX * 2
        guard abs(wanted - contentWidthFloor.constant) > 0.5 else { return }
        contentWidthFloor.constant = wanted
    }

    public func applyTheme(_ palette: SemanticPalette) {
        surface.layer?.cornerRadius = Self.cornerRadius
        surface.layer?.borderWidth = Self.borderWidth
        surface.layer?.backgroundColor = palette.surfaceColor.cgColor
        surface.layer?.borderColor = palette.outlineColor.cgColor

        var titleStyle = palette.theme.typography.style(.body)
        titleStyle.weight = .semibold
        titleField.font = titleStyle.nsFont(scaledSize: scaledSize)
        titleField.textColor = titleIsAccent ? palette.accentColor : palette.primaryTextColor

        subtitleField.font = palette.theme.typography.style(.caption)
            .nsFont(scaledSize: scaledSize * 0.85)
        subtitleField.textColor = palette.tertiaryTextColor

        statusIcon.contentTintColor = palette.color(named: status?.colorName)
            ?? palette.secondaryTextColor
        disclosure.contentTintColor = palette.secondaryTextColor

        let line = Self.summaryString(summary, palette: palette, scaledSize: scaledSize)
        summaryField.attributedStringValue = line
        let summaryWidth = ceil(line.size().width)
        summarySlotWidth?.constant = summaryWidth
        // The title is measured at its full length, not at whatever the line
        // currently affords it: a card that carries a summary is as wide as the
        // two of them plus the toggle, so the address is truncated only by a
        // window that cannot be any wider.
        mastheadWidthFloor = summary.isEmpty ? 0 : ceil(titleField.fittingSize.width)
            + Self.mastheadGap + summaryWidth
            + Self.trailingSpacing + ceil(disclosure.fittingSize.width)
        updateContentWidthFloor()
    }

    /// `5H: 23% | 7D: 12%` — each name in the quietest text tier, each value in
    /// the colour its part carries (which is the same colour the open card gives
    /// that reading, so folding a card changes what is on screen and never what
    /// it says).
    private static func summaryString(
        _ parts: [SummaryPart], palette: SemanticPalette, scaledSize: CGFloat
    ) -> NSAttributedString {
        let typography = palette.theme.typography
        let nameFont = typography.style(.caption).nsFont(scaledSize: scaledSize * 0.85)
        let valueFont = typography.style(.code).nsFont(scaledSize: scaledSize * 0.85)
        let line = NSMutableAttributedString()
        for (index, part) in parts.enumerated() {
            if index > 0 {
                line.append(NSAttributedString(
                    string: "  |  ",
                    attributes: [.font: nameFont, .foregroundColor: palette.tertiaryTextColor]
                ))
            }
            line.append(NSAttributedString(
                string: "\(part.name): ",
                attributes: [.font: nameFont, .foregroundColor: palette.tertiaryTextColor]
            ))
            line.append(NSAttributedString(
                string: part.value,
                attributes: [
                    .font: valueFont,
                    .foregroundColor: part.color(palette) ?? palette.secondaryTextColor
                ]
            ))
        }
        return line
    }
}

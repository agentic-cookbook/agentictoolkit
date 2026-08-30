import AgenticToolkitCore
import AgenticToolkitCoreMacOS
import AppKit

/// A titled card that folds: a rounded surface, a one-line masthead, and
/// whatever content is added to it.
///
///     ┌──────────────────────────────────────────────┐
///     │ mike@example.com                       👍  ▾ │
///     │ …content…                                    │
///     └──────────────────────────────────────────────┘
///
///     ┌──────────────────────────────────────────────┐
///     │ me@example.com       5H: 23% | 7D: 12%  👍  ▸ │
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
/// of each line starting wherever its own title happened to stop. The status
/// slot is reserved on every card whether or not that card has a standing to
/// show — otherwise the summaries on the cards WITH an icon sit one icon further
/// left than the rest, and the column the alignment exists to make is broken by
/// the cards that most need reading. What symbols the slot must hold is the
/// host's to say (`statusVocabulary`): the card measures the widest of them
/// rather than knowing any of them.
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
        public let colorName: String?

        public init(name: String, value: String, colorName: String?) {
            self.name = name
            self.value = value
            self.colorName = colorName
        }
    }

    /// What a card says about its own standing, drawn immediately before the
    /// disclosure toggle. `accessibilityLabel` is also the tooltip: a symbol is
    /// compact, not self-explaining, and the word it replaced has to stay
    /// reachable somewhere.
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
    private let statusIcon = NSImageView()
    private let disclosure = NSButton()
    private let content = NSStackView()

    /// Accent (an identifier, an address) vs. primary text (a plain heading).
    private let titleIsAccent: Bool
    private let summary: [SummaryPart]
    private let status: StatusSymbol?
    private let statusVocabulary: [String]
    private let scaledSize: CGFloat
    private let onToggle: ((Bool) -> Void)?

    private var observer: ThemePaletteObserver?

    /// Width of the reserved summary well, re-measured whenever the palette
    /// (and so the summary's fonts) changes.
    private var summarySlotWidth: NSLayoutConstraint?
    /// The card's fold-independent width floor: as wide as its content wants to
    /// be, whether or not the content is currently drawn.
    private var contentWidthFloor: NSLayoutConstraint?

    private static let cornerRadius: CGFloat = 10
    private static let borderWidth: CGFloat = 1
    private static let horizontalInset: CGFloat = 14
    private static let verticalInset: CGFloat = 12
    /// How far a dimmed card recedes. Far enough to sort one card out of a list
    /// at a glance, not so far that the dimmed cards stop being readable.
    private static let dimmedAlpha: CGFloat = 0.55

    private let padX: CGFloat
    private let padY: CGFloat

    public init(
        title: String,
        titleIsAccent: Bool,
        subtitle: String? = nil,
        summary: [SummaryPart] = [],
        status: StatusSymbol? = nil,
        statusVocabulary: [String] = [],
        isCollapsed: Bool = false,
        isDimmed: Bool = false,
        scaledSize: CGFloat,
        onToggle: ((Bool) -> Void)? = nil
    ) {
        self.titleIsAccent = titleIsAccent
        self.summary = summary
        self.status = status
        self.statusVocabulary = statusVocabulary
        self.scaledSize = scaledSize
        self.onToggle = onToggle
        self.padX = ceil(Self.horizontalInset * scaledSize / CGFloat(NSFont.systemFontSize))
        self.padY = ceil(Self.verticalInset * scaledSize / CGFloat(NSFont.systemFontSize))
        super.init(frame: .zero)
        // Whole-card alpha rather than a second set of dimmed colours: the card
        // recedes complete — border, surface, content and all — and every colour
        // it draws keeps meaning exactly what it means on the live card.
        alphaValue = isDimmed ? Self.dimmedAlpha : 1.0
        translatesAutoresizingMaskIntoConstraints = false
        wantsLayer = true

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
        configureStatusIcon()
        configureDisclosure(isCollapsed: isCollapsed)

        content.orientation = .vertical
        content.alignment = .width
        content.spacing = 12
        content.translatesAutoresizingMaskIntoConstraints = false
        content.isHidden = isCollapsed

        // The title at the left edge; the collapsed summary, the status slot and
        // the toggle at the right, in that order. All three right-hand pieces are
        // on the same rail on every card — the status slot keeps its width
        // whether or not this card has a standing, and the summary well keeps its
        // width whether or not this card is folded — so the summaries line up as
        // a column and the toggle is always in the same place.
        let trailing = NSStackView(views: [summarySlot, statusIcon, disclosure])
        trailing.orientation = .horizontal
        trailing.alignment = .centerY
        trailing.spacing = 6
        trailing.translatesAutoresizingMaskIntoConstraints = false

        let header = PinnedEndsLine.make(
            leading: titleField, trailing: trailing, alignment: .centerY
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
        addSubview(stack)

        let floor = widthAnchor.constraint(greaterThanOrEqualToConstant: 0)
        // Just under required: on a screen too narrow for the content the window
        // scrolls rather than the layout becoming unsatisfiable.
        floor.priority = NSLayoutConstraint.Priority(999)
        contentWidthFloor = floor

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: padY),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -padY),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: padX),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -padX),
            floor
        ])

        observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    /// The summary's well: present on every card, in both states, so folding
    /// moves nothing sideways. The field inside it is what appears and
    /// disappears; the well keeps the width.
    private func configureSummarySlot(isCollapsed: Bool) {
        summaryField.translatesAutoresizingMaskIntoConstraints = false
        summaryField.alignment = .right
        summaryField.lineBreakMode = .byClipping
        summaryField.setContentCompressionResistancePriority(.required, for: .horizontal)
        summaryField.setContentHuggingPriority(.required, for: .horizontal)
        summaryField.isHidden = !(isCollapsed && !summary.isEmpty)

        summarySlot.translatesAutoresizingMaskIntoConstraints = false
        // A card that has no summary at all reserves nothing — that is not a
        // fold-dependent difference, so it cannot move anything sideways.
        summarySlot.isHidden = summary.isEmpty
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

    /// The status slot: a fixed-width well that holds this card's symbol, or
    /// nothing. Not hidden when empty — a hidden view leaves an `NSStackView`'s
    /// layout entirely, which is exactly the shift the reserved slot exists to
    /// prevent.
    private func configureStatusIcon() {
        statusIcon.translatesAutoresizingMaskIntoConstraints = false
        statusIcon.imageScaling = .scaleProportionallyDown
        statusIcon.setContentCompressionResistancePriority(.required, for: .horizontal)
        statusIcon.widthAnchor.constraint(
            equalToConstant: Self.statusSlotWidth(
                symbolNames: statusVocabulary + [status?.symbolName].compactMap { $0 },
                scaledSize: scaledSize
            )
        ).isActive = true
        guard let status else { return }
        statusIcon.image = NSImage(
            systemSymbolName: status.symbolName,
            accessibilityDescription: status.accessibilityLabel
        )
        statusIcon.symbolConfiguration = Self.statusSymbolConfiguration(scaledSize: scaledSize)
        statusIcon.toolTip = status.accessibilityLabel
    }

    /// The reserved width of the status slot at this text size: the widest
    /// symbol the host says a card in this stack can draw, as it will actually
    /// be drawn. Measured rather than guessed at a multiple of the font size —
    /// the guess is wrong the moment a symbol with a different aspect is chosen,
    /// and it is wrong invisibly. Zero when there are no symbols at all, so a
    /// stack with no standings to show reserves nothing.
    public static func statusSlotWidth(symbolNames: [String], scaledSize: CGFloat) -> CGFloat {
        guard !symbolNames.isEmpty else { return 0 }
        let configuration = statusSymbolConfiguration(scaledSize: scaledSize)
        let widths = symbolNames.compactMap {
            NSImage(systemSymbolName: $0, accessibilityDescription: nil)?
                .withSymbolConfiguration(configuration)?.size.width
        }
        return ceil(widths.max() ?? scaledSize)
    }

    private static func statusSymbolConfiguration(
        scaledSize: CGFloat
    ) -> NSImage.SymbolConfiguration {
        NSImage.SymbolConfiguration(pointSize: ceil(scaledSize * 0.95), weight: .semibold)
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
        let wanted = ceil(content.fittingSize.width) + padX * 2
        guard abs(wanted - contentWidthFloor.constant) > 0.5 else { return }
        contentWidthFloor.constant = wanted
    }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.cornerRadius = Self.cornerRadius
        layer?.borderWidth = Self.borderWidth
        layer?.backgroundColor = palette.surfaceColor.cgColor
        layer?.borderColor = palette.outlineColor.cgColor

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
        summarySlotWidth?.constant = ceil(line.size().width)
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
                    .foregroundColor: palette.color(named: part.colorName)
                        ?? palette.secondaryTextColor
                ]
            ))
        }
        return line
    }
}

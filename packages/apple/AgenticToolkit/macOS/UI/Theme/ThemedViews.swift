import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A layer-backed view filled with a single semantic role color. Use it for
/// window/content backgrounds and panels. Repaints live on theme change.
@MainActor
public final class ThemedBackgroundView: NSView, Themeable {
    public let role: ThemeRole
    private var observer: ThemePaletteObserver?

    public init(role: ThemeRole = .windowBackground) {
        self.role = role
        super.init(frame: .zero)
        self.wantsLayer = true
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette.nsColor(role).cgColor
    }
}

/// A non-editable label whose text color tracks a `ThemeRole` and whose font
/// tracks a `TextRole` (so both color *and* size/weight follow the theme).
@MainActor
public final class ThemedLabel: NSTextField, Themeable {
    public var role: ThemeRole { didSet { applyTheme(ThemePaletteObserver.currentPalette) } }
    public var textRole: TextRole { didSet { applyTheme(ThemePaletteObserver.currentPalette) } }
    private var observer: ThemePaletteObserver?

    public init(string: String = "", role: ThemeRole = .primaryText, textRole: TextRole = .body) {
        self.role = role
        self.textRole = textRole
        super.init(frame: .zero)
        self.isEditable = false
        self.isBordered = false
        self.isBezeled = false
        self.drawsBackground = false
        // The rest of `NSTextField(labelWithString:)`'s defaults, which
        // `init(frame:)` does not give: a field built by frame wraps, breaks on
        // words, and asks for 150 × 64 points. A label does none of that, and
        // every caller of this class uses it as one — a toolbar caption, a table
        // cell, a form value — so a two-line intrinsic height was a caption
        // fighting a 40-point toolbar for room it never needed.
        self.cell?.wraps = false
        self.cell?.usesSingleLineMode = true
        self.lineBreakMode = .byClipping
        self.stringValue = string
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        textColor = palette.nsColor(role)
        font = palette.font(textRole)
    }
}

/// A label that emphasises the characters a filter matched.
///
/// The ranges are handed in rather than worked out here: what counts as a match
/// belongs to whoever is doing the filtering, and a label that decided for
/// itself would be a second answer to the same question (`dry`). The attributed
/// string is rebuilt on every palette change, because the emphasis is a colour
/// and a weight and both of those are the theme's to say.
@MainActor
public final class ThemedHighlightLabel: NSTextField, Themeable {
    public var role: ThemeRole { didSet { applyTheme(ThemePaletteObserver.currentPalette) } }
    public var textRole: TextRole { didSet { applyTheme(ThemePaletteObserver.currentPalette) } }
    public var text: String { didSet { applyTheme(ThemePaletteObserver.currentPalette) } }
    public var highlightedRanges: [NSRange] { didSet { applyTheme(ThemePaletteObserver.currentPalette) } }
    private var observer: ThemePaletteObserver?

    public init(
        string: String = "",
        highlighting ranges: [NSRange] = [],
        role: ThemeRole = .primaryText,
        textRole: TextRole = .body
    ) {
        self.role = role
        self.textRole = textRole
        self.text = string
        self.highlightedRanges = ranges
        super.init(frame: .zero)
        self.isEditable = false
        self.isBordered = false
        self.isBezeled = false
        self.drawsBackground = false
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
        applyTheme(ThemePaletteObserver.currentPalette)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        let base = palette.font(textRole)
        let string = NSMutableAttributedString(string: text, attributes: [
            .font: base,
            .foregroundColor: palette.nsColor(role)
        ])
        let bold = NSFontManager.shared.convert(base, toHaveTrait: .boldFontMask)
        let whole = NSRange(location: 0, length: (text as NSString).length)
        for range in highlightedRanges where NSIntersectionRange(range, whole) == range {
            string.addAttributes([
                .font: bold,
                .foregroundColor: palette.nsColor(.accent)
            ], range: range)
        }
        attributedStringValue = string
    }
}

/// An editable text field themed from the palette: control-background fill,
/// primary text, body font, and a placeholder in the placeholder-text role.
@MainActor
public final class ThemedTextField: NSTextField, Themeable {
    private var observer: ThemePaletteObserver?

    public init(string: String = "") {
        super.init(frame: .zero)
        self.stringValue = string
        self.isEditable = true
        self.isBezeled = true
        self.bezelStyle = .roundedBezel
        self.drawsBackground = true
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        backgroundColor = palette.controlBackgroundColor
        textColor = palette.primaryTextColor
        font = palette.font(.body)
        if let placeholder = placeholderString {
            placeholderAttributedString = NSAttributedString(string: placeholder, attributes: [
                .foregroundColor: palette.placeholderTextColor,
                .font: palette.font(.body)
            ])
        }
    }
}

/// A search field whose text, placeholder and fill follow the palette.
/// `NSSearchField` draws its own bezel and magnifier, so only the parts the
/// theme actually owns are overridden (`native-controls`).
@MainActor
public final class ThemedSearchField: NSSearchField, Themeable {
    private var observer: ThemePaletteObserver?

    public init(placeholder: String = "") {
        super.init(frame: .zero)
        self.placeholderString = placeholder
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        textColor = palette.primaryTextColor
        font = palette.font(.body)
        if let placeholder = placeholderString {
            placeholderAttributedString = NSAttributedString(string: placeholder, attributes: [
                .foregroundColor: palette.placeholderTextColor,
                .font: palette.font(.body)
            ])
        }
    }
}

/// A flat, layer-backed button filled with the accent color and an automatically
/// contrasting title. Avoids fighting AppKit's bezel styles so the theme fully
/// controls its appearance.
@MainActor
public final class ThemedButton: NSButton, Themeable {
    private var observer: ThemePaletteObserver?

    public init(title: String, target: AnyObject? = nil, action: Selector? = nil) {
        super.init(frame: .zero)
        self.title = title
        self.target = target
        self.action = action
        self.isBordered = false
        self.bezelStyle = .regularSquare
        self.wantsLayer = true
        self.layer?.cornerRadius = 6
        self.focusRingType = .none
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette.nsColor(.accent).cgColor
        attributedTitle = NSAttributedString(string: title, attributes: [
            .foregroundColor: palette.onAccentTextColor,
            .font: palette.font(.button)
        ])
    }
}

@MainActor
public extension NSButton {

    /// Paint a stock push button as the *secondary* action of a themed dialog
    /// (Cancel/Close, sitting beside a blue default button).
    ///
    /// A non-default push button draws *nothing* in these themed windows — no
    /// bezel and no title, though it is enabled, sized, and hit-testable (its
    /// sibling default button, the one with a Return key equivalent, draws
    /// fine). `bezelColor` doesn't rescue it either. So the button leaves the
    /// stock bezel behind and paints itself: an elevated surface one clear step
    /// above the window backdrop, outlined, with primary-emphasis text — the
    /// things that say "enabled".
    ///
    /// Borderless buttons have no bezel padding, so callers give the button its
    /// size (matching the default button beside it) rather than leaning on an
    /// intrinsic size that is now just the title.
    func applySecondaryActionTheme(_ palette: SemanticPalette) {
        isBordered = false
        bezelStyle = .regularSquare
        focusRingType = .none
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.borderWidth = 1
        layer?.backgroundColor = palette.nsColor(.elevatedSurface).cgColor
        layer?.borderColor = palette.nsColor(.outline).cgColor
        contentTintColor = palette.primaryTextColor
        attributedTitle = NSAttributedString(string: title, attributes: [
            .foregroundColor: palette.primaryTextColor,
            // The theme's button font, like `ThemedButton` — not the control's own
            // `font`, which is never nil on a stock NSButton and so would pin this
            // to AppKit's system font forever.
            .font: palette.font(.button),
            .paragraphStyle: {
                let style = NSMutableParagraphStyle()
                style.alignment = .center
                return style
            }()
        ])
    }
}

/// The themed secondary action as a *control* rather than a paint job: it sizes
/// itself from the palette's own button font, and it reacts to being pressed.
///
/// ``NSButton/applySecondaryActionTheme(_:)`` stays for the stock buttons in
/// dialogs that a caller lays out by hand. What an extension cannot do is the
/// two things a button in a toolbar needs.
///
/// Its size: a borderless button's intrinsic size is only its title, so callers
/// pinned a hard width instead — and `palette.font(.button)` scales with the
/// theme's `sizeScale`, so at 1.5 the word "Resume" is wider than the 68 points
/// it was given and clips with no ellipsis to say so. Sizing from the title
/// that will actually be drawn cannot go wrong that way.
///
/// Its pressed state: the explicit `.foregroundColor` on the attributed title is
/// precisely what stops AppKit dimming a borderless button's text on mouse-down,
/// so the painted version gave no feedback at all when clicked. The fill answers
/// instead.
@MainActor
public final class ThemedSecondaryButton: NSButton, Themeable {

    /// The floor: the stock textured-rounded metrics, so a short title still
    /// looks like a button and a row of them stays even.
    public static let minimumSize = NSSize(width: 68, height: 22)

    /// Room around the title, so a long one is not painted edge to edge.
    private static let padding = NSSize(width: 20, height: 8)

    private var observer: ThemePaletteObserver?

    public init(title: String, target: AnyObject? = nil, action: Selector? = nil) {
        super.init(frame: .zero)
        self.title = title
        self.target = target
        self.action = action
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    /// Re-titling repaints. The attributed title is built from `title` when the
    /// theme is applied, so assigning `title` alone would change the property
    /// and leave the old word on screen — the bug every caller had to know
    /// about, now the class's own business.
    public override var title: String {
        didSet { applyTheme(ThemePaletteObserver.currentPalette) }
    }

    public override var isHighlighted: Bool {
        didSet { paintFill(ThemePaletteObserver.currentPalette) }
    }

    public override var intrinsicContentSize: NSSize {
        let title = attributedTitle.size()
        return NSSize(
            width: max(Self.minimumSize.width, ceil(title.width) + Self.padding.width),
            height: max(Self.minimumSize.height, ceil(title.height) + Self.padding.height))
    }

    public func applyTheme(_ palette: SemanticPalette) {
        applySecondaryActionTheme(palette)
        paintFill(palette)
        invalidateIntrinsicContentSize()
    }

    private func paintFill(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette
            .nsColor(isHighlighted ? .selection : .elevatedSurface).cgColor
    }
}

/// A panel: a layer-backed surface fill with an optional outline stroke and
/// rounded corners. Replaces raw `NSBox`/`.controlBackgroundColor` boxes so the
/// theme drives panel background **and** border/outline color.
@MainActor
public final class ThemedBox: NSView, Themeable {
    public let fillRole: ThemeRole
    public let strokeRole: ThemeRole?
    private var observer: ThemePaletteObserver?

    public init(fill: ThemeRole = .surface, stroke: ThemeRole? = .outline, cornerRadius: CGFloat = 8) {
        self.fillRole = fill
        self.strokeRole = stroke
        super.init(frame: .zero)
        self.wantsLayer = true
        self.layer?.cornerRadius = cornerRadius
        self.layer?.borderWidth = stroke == nil ? 0 : 1
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette.nsColor(fillRole).cgColor
        if let strokeRole {
            layer?.borderColor = palette.nsColor(strokeRole).cgColor
        }
    }
}

/// A one-point hairline. Defaults to the `border` role; pass `.divider` for a
/// fainter line.
@MainActor
public final class ThemedSeparatorView: NSView, Themeable {
    public let role: ThemeRole
    private var observer: ThemePaletteObserver?

    public init(role: ThemeRole = .border) {
        self.role = role
        super.init(frame: .zero)
        self.wantsLayer = true
        self.heightAnchor.constraint(equalToConstant: 1).isActive = true
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette.nsColor(role).cgColor
    }
}

/// A split view whose divider comes from the palette.
///
/// `NSSplitView` draws its divider from a system color that no theme reaches,
/// so a themed window ends up with a system-grey seam down the middle. This is
/// the one hook AppKit gives for it. Split view *controllers* get it by
/// subclassing `ThemedSplitViewController` rather than assigning this directly.
@MainActor
open class ThemedSplitView: NSSplitView, Themeable {
    private var observer: ThemePaletteObserver?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        // `NSSplitView` is born stacked, but `NSSplitViewController` hands out a
        // side-by-side one — so a controller that swapped in a themed split view
        // and never said otherwise silently turned its sidebar into a header.
        // Match what is being replaced: this subclass exists to recolour a
        // divider, not to reorient a window.
        self.isVertical = true
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    /// Visible to subclasses that paint more than the divider from the theme.
    public private(set) var currentPalette: SemanticPalette = ThemePaletteObserver.currentPalette

    open override var dividerColor: NSColor { currentPalette.nsColor(.divider) }

    open func applyTheme(_ palette: SemanticPalette) {
        currentPalette = palette
        needsDisplay = true
    }
}

/// An `NSSplitViewController` whose divider follows the theme.
///
/// The swap lives in `loadView()` because AppKit allows `splitView` to be
/// assigned only *before* the view is loaded — doing it in `viewDidLoad` raises
/// `NSInternalInconsistencyException` ("The -splitView can only be assigned
/// before the view is loaded"), which AppKit swallows at the top of the run
/// loop and which therefore aborts whatever was mid-way through building the
/// controller. Subclassing keeps that one-shot constraint in one place.
@MainActor
open class ThemedSplitViewController: NSSplitViewController {

    /// The split view to install. Overridable because the assignment is
    /// one-shot and happens here — a subclass that wants a different
    /// `ThemedSplitView` (a wider divider, a differently painted one) has
    /// nowhere else to say so.
    open func makeSplitView() -> ThemedSplitView { ThemedSplitView() }

    open override func loadView() {
        splitView = makeSplitView()
        super.loadView()
    }

    /// A split view with a custom `dividerColor` gets view-backed dividers, and
    /// AppKit asks a view-backed divider whether to hide itself while measuring
    /// the split view inside `viewDidLoad` — before any subclass has added its
    /// items. `NSSplitViewController`'s own implementation indexes
    /// `splitViewItems` unguarded and throws on the empty array, so the answer
    /// for an item that doesn't exist yet has to come from here.
    open override func splitView(_ splitView: NSSplitView, shouldHideDividerAt dividerIndex: Int) -> Bool {
        guard dividerIndex < splitViewItems.count else { return false }
        return super.splitView(splitView, shouldHideDividerAt: dividerIndex)
    }
}

/// A scroll view whose backdrop tracks the window-background role.
@MainActor
public final class ThemedScrollView: NSScrollView, Themeable {
    private var observer: ThemePaletteObserver?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        self.drawsBackground = true
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        backgroundColor = palette.nsColor(.windowBackground)
    }
}

/// A table whose backdrop tracks a semantic role. A plain `NSTableView` fills
/// itself with the system `controlBackgroundColor`, painting over whatever
/// themed scroll view hosts it — so a list stays system-grey inside an otherwise
/// themed window. Defaults to `surface` so a list reads as its own plane against
/// `windowBackground`; pass `.windowBackground` to make it disappear into the
/// window instead.
///
/// Alternating row colors are off because they come from a system color pair the
/// palette has no say in; a themed list gets its banding, if any, from row views.
@MainActor
public final class ThemedTableView: NSTableView, Themeable {
    public let role: ThemeRole
    private var observer: ThemePaletteObserver?

    public init(role: ThemeRole = .surface) {
        self.role = role
        super.init(frame: .zero)
        self.usesAlternatingRowBackgroundColors = false
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        backgroundColor = palette.nsColor(role)
        gridColor = palette.nsColor(.divider)
    }
}

/// The outline counterpart of `ThemedTableView`, for the same reason it exists:
/// an untinted outline paints the system's table background through whatever
/// the theme put behind it.
@MainActor
public final class ThemedOutlineView: NSOutlineView, Themeable {
    public let role: ThemeRole
    private var observer: ThemePaletteObserver?

    public init(role: ThemeRole = .surface) {
        self.role = role
        super.init(frame: .zero)
        self.usesAlternatingRowBackgroundColors = false
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        backgroundColor = palette.nsColor(role)
        gridColor = palette.nsColor(.divider)
    }
}

/// A table row view whose selection fill uses the `selection` role. Observes the
/// theme so reused row instances repaint live; without this, an AppKit-pooled row
/// keeps the palette captured at creation and draws stale selection after a swap.
@MainActor
public final class ThemedTableRowView: NSTableRowView, Themeable {
    private(set) var palette: SemanticPalette = ThemePaletteObserver.currentPalette
    private var observer: ThemePaletteObserver?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        self.palette = palette
        needsDisplay = true
    }

    public override func drawSelection(in dirtyRect: NSRect) {
        guard selectionHighlightStyle != .none else { return }
        palette.nsColor(.selection).setFill()
        let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 2, dy: 1), xRadius: 4, yRadius: 4)
        path.fill()
    }
}

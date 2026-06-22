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

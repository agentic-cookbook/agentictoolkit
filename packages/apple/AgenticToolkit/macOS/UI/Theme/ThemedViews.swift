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

/// A non-editable label whose text color tracks a semantic role.
@MainActor
public final class ThemedLabel: NSTextField, Themeable {
    public var role: ThemeRole { didSet { applyTheme(ThemePaletteObserver.currentPalette) } }
    private var observer: ThemePaletteObserver?

    public init(string: String = "", role: ThemeRole = .primaryText) {
        self.role = role
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
        let accent = palette.color(.accent)
        layer?.backgroundColor = NSColor(accent).cgColor
        let titleColor: NSColor = accent.isDark ? .white : .black
        attributedTitle = NSAttributedString(string: title, attributes: [
            .foregroundColor: titleColor,
            .font: font ?? NSFont.systemFont(ofSize: NSFont.systemFontSize)
        ])
    }
}

/// A one-point hairline using the `border` role. Defaults to horizontal.
@MainActor
public final class ThemedSeparatorView: NSView, Themeable {
    private var observer: ThemePaletteObserver?

    public init() {
        super.init(frame: .zero)
        self.wantsLayer = true
        self.heightAnchor.constraint(equalToConstant: 1).isActive = true
        self.observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette.nsColor(.border).cgColor
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

/// A table row view whose selection fill uses the `selection` role.
@MainActor
public final class ThemedTableRowView: NSTableRowView {
    public var palette: SemanticPalette = ThemePaletteObserver.currentPalette

    public override func drawSelection(in dirtyRect: NSRect) {
        guard selectionHighlightStyle != .none else { return }
        palette.nsColor(.selection).setFill()
        let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 2, dy: 1), xRadius: 4, yRadius: 4)
        path.fill()
    }
}

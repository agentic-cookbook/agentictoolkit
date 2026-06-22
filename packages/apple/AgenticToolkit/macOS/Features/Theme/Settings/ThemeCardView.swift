import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A theme gallery card: a rendered `ThemeThumbnailView` plus the theme name and
/// appearance, with an accent ring on the active theme. Clicking it selects the
/// theme. The card persists across theme switches, so it observes the palette to
/// keep its labels readable on the themed panel.
final class ThemeCardView: NSView {
    let themeID: String
    var isActive: Bool { didSet { needsDisplay = true } }
    private var theme: ColorTheme
    private let onSelect: (String) -> Void
    private let thumbnail: ThemeThumbnailView
    private let nameLabel = NSTextField(labelWithString: "")
    private let appearanceLabel = NSTextField(labelWithString: "")
    private var observer: ThemePaletteObserver?

    init(theme: ColorTheme, isActive: Bool, onSelect: @escaping (String) -> Void) {
        self.themeID = theme.id
        self.theme = theme
        self.isActive = isActive
        self.onSelect = onSelect
        self.thumbnail = ThemeThumbnailView(theme: theme)
        super.init(frame: .zero)
        wantsLayer = true
        translatesAutoresizingMaskIntoConstraints = false

        thumbnail.translatesAutoresizingMaskIntoConstraints = false
        thumbnail.wantsLayer = true
        thumbnail.layer?.cornerRadius = 7
        thumbnail.layer?.masksToBounds = true

        nameLabel.stringValue = theme.name
        nameLabel.font = .systemFont(ofSize: 12, weight: .medium)
        nameLabel.lineBreakMode = .byTruncatingTail
        nameLabel.translatesAutoresizingMaskIntoConstraints = false
        appearanceLabel.stringValue = theme.appearance.rawValue.capitalized
        appearanceLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        appearanceLabel.translatesAutoresizingMaskIntoConstraints = false

        addSubview(thumbnail)
        addSubview(nameLabel)
        addSubview(appearanceLabel)
        NSLayoutConstraint.activate([
            thumbnail.topAnchor.constraint(equalTo: topAnchor, constant: 6),
            thumbnail.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
            thumbnail.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
            thumbnail.heightAnchor.constraint(equalToConstant: 96),
            nameLabel.topAnchor.constraint(equalTo: thumbnail.bottomAnchor, constant: 6),
            nameLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            nameLabel.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -8),
            appearanceLabel.leadingAnchor.constraint(equalTo: nameLabel.leadingAnchor),
            appearanceLabel.topAnchor.constraint(equalTo: nameLabel.bottomAnchor, constant: 1),
            appearanceLabel.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8)
        ])

        // The card persists across theme switches (unlike the rebuilt editor), so
        // its labels must observe the palette to stay readable on the themed panel.
        observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func applyTheme(_ palette: SemanticPalette) {
        nameLabel.textColor = palette.primaryTextColor
        appearanceLabel.textColor = palette.tertiaryTextColor
    }

    func update(theme: ColorTheme) {
        self.theme = theme
        nameLabel.stringValue = theme.name
        appearanceLabel.stringValue = theme.appearance.rawValue.capitalized
        thumbnail.update(theme: theme)
    }

    override func updateLayer() {
        // Minimal chrome: the rendered thumbnail carries its own hairline; only the
        // active card gets an accent ring so the gallery stays clean.
        layer?.cornerRadius = 10
        layer?.borderWidth = isActive ? 3 : 0
        layer?.borderColor = NSColor.controlAccentColor.cgColor
        layer?.backgroundColor = NSColor.clear.cgColor
    }

    override var wantsUpdateLayer: Bool { true }

    override func mouseDown(with event: NSEvent) { onSelect(themeID) }
}

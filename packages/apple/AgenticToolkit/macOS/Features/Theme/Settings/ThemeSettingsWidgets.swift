import AppKit
import AgenticToolkitCore

/// A document view that pins its content to the top (AppKit's default flips the
/// origin to the bottom-left). Used as the scroll document for the theme gallery.
final class ThemeFlippedView: NSView {
    override var isFlipped: Bool { true }
}

/// A titled "card": a header label above a rounded, outlined surface (`ThemedBox`)
/// holding the section's content. Each part of a theme (Preview, Details, Colors,
/// Typography, Terminal palette) is shown as its own card, so the editor reads as
/// a set of labeled panels rather than a stack of disclosure triangles.
final class ThemeCard: NSView {

    private let header = NSTextField(labelWithString: "")
    private var observer: ThemePaletteObserver?

    init(title: String, content: NSView) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        header.stringValue = title
        header.font = .systemFont(ofSize: 12, weight: .semibold)
        header.textColor = resolvedThemeScope.palette.secondaryTextColor
        header.translatesAutoresizingMaskIntoConstraints = false

        content.translatesAutoresizingMaskIntoConstraints = false

        // Elevated (vs. the detail pane's own surface) with an outline, so cards
        // read as distinct panels against the background.
        let box = ThemedBox(fill: .elevatedSurface, stroke: .outline, cornerRadius: 10)
        box.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(content)
        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: box.topAnchor, constant: 14),
            content.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 14),
            content.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -14),
            content.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -14)
        ])

        addSubview(header)
        addSubview(box)
        NSLayoutConstraint.activate([
            header.topAnchor.constraint(equalTo: topAnchor),
            header.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            header.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor),

            box.topAnchor.constraint(equalTo: header.bottomAnchor, constant: 6),
            box.leadingAnchor.constraint(equalTo: leadingAnchor),
            box.trailingAnchor.constraint(equalTo: trailingAnchor),
            box.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])

        // Recolor the header live so editing the active theme updates it too.
        observer = ThemePaletteObserver(host: self) { [weak self] palette in
            self?.header.textColor = palette.secondaryTextColor
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}

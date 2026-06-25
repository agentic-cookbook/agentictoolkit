import AppKit

/// A small rounded "pill" label — a status or category badge (e.g. "dev",
/// "stopped", "3"). Theme-agnostic: the caller supplies the color (typically drawn
/// from a `SemanticPalette`) and the badge owns the pill shape, padding, and text
/// styling, so it is reusable across apps that build list rows and status chips.
@MainActor
public final class Badge: NSView {

    /// Whether the badge is a solid chip or an outlined one.
    public enum Style: Sendable {
        /// Solid `color` background with contrasting text.
        case filled
        /// Clear background with a `color` border and `color` text.
        case outlined
    }

    private let label = NSTextField(labelWithString: "")
    private var style: Style = .filled
    private var color: NSColor = .secondaryLabelColor

    public init(text: String, color: NSColor, style: Style = .filled) {
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 5
        translatesAutoresizingMaskIntoConstraints = false

        label.translatesAutoresizingMaskIntoConstraints = false
        label.font = .systemFont(ofSize: 10, weight: .semibold)
        label.alignment = .center
        label.setContentHuggingPriority(.required, for: .horizontal)
        addSubview(label)
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 6),
            label.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -6),
            label.topAnchor.constraint(equalTo: topAnchor, constant: 2),
            label.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -2)
        ])
        setContentHuggingPriority(.required, for: .horizontal)
        update(text: text, color: color, style: style)
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    /// Restyle the badge in place (e.g. when the theme palette changes).
    public func update(text: String, color: NSColor, style: Style = .filled) {
        self.color = color
        self.style = style
        label.stringValue = text
        applyStyle()
    }

    private func applyStyle() {
        switch style {
        case .filled:
            layer?.backgroundColor = color.cgColor
            layer?.borderWidth = 0
            label.textColor = Self.contrastingTextColor(on: color)
        case .outlined:
            layer?.backgroundColor = NSColor.clear.cgColor
            layer?.borderWidth = 1
            layer?.borderColor = color.cgColor
            label.textColor = color
        }
    }

    /// Black or white, whichever reads better on `background` (relative luminance).
    private static func contrastingTextColor(on background: NSColor) -> NSColor {
        guard let rgb = background.usingColorSpace(.sRGB) else { return .white }
        let luminance = 0.299 * rgb.redComponent + 0.587 * rgb.greenComponent + 0.114 * rgb.blueComponent
        return luminance > 0.6 ? .black : .white
    }
}

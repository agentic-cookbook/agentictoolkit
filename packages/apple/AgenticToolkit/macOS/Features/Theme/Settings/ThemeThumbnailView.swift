import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Draws a miniature app-window rendering of a theme: titlebar with traffic
/// lights, title/body/caption bars, an accent pill, status dots and a code line.
/// Used by the theme gallery's `ThemeCardView` to "show, don't tell".
final class ThemeThumbnailView: NSView {
    private var palette: SemanticPalette

    init(theme: ColorTheme) {
        self.palette = SemanticPalette(theme: theme)
        super.init(frame: .zero)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    func update(theme: ColorTheme) {
        palette = SemanticPalette(theme: theme)
        needsDisplay = true
    }

    override var isFlipped: Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        let bounds = self.bounds
        func fill(_ rect: NSRect, _ color: NSColor, radius: CGFloat = 0) {
            color.setFill()
            NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius).fill()
        }
        // Window background.
        fill(bounds, palette.nsColor(.windowBackground))
        // Title bar.
        let titleBarHeight: CGFloat = 18
        fill(NSRect(x: 0, y: 0, width: bounds.width, height: titleBarHeight), palette.nsColor(.surface))
        for (index, role) in [ThemeRole.danger, .warning, .success].enumerated() {
            let dot = NSRect(x: 8 + CGFloat(index) * 11, y: titleBarHeight / 2 - 3, width: 6, height: 6)
            fill(dot, palette.nsColor(role), radius: 3)
        }
        // Content.
        let left: CGFloat = 12
        var row = titleBarHeight + 12
        fill(NSRect(x: left, y: row, width: bounds.width * 0.5, height: 7),
             palette.nsColor(.primaryText), radius: 2)
        row += 14
        fill(NSRect(x: left, y: row, width: bounds.width * 0.72, height: 5),
             palette.nsColor(.secondaryText), radius: 2)
        row += 10
        fill(NSRect(x: left, y: row, width: bounds.width * 0.6, height: 5),
             palette.nsColor(.secondaryText), radius: 2)
        row += 14
        fill(NSRect(x: left, y: row, width: 38, height: 14), palette.nsColor(.accent), radius: 4)
        for (index, role) in [ThemeRole.info, .warning, .danger].enumerated() {
            let dot = NSRect(x: left + 48 + CGFloat(index) * 12, y: row + 3, width: 8, height: 8)
            fill(dot, palette.nsColor(role), radius: 4)
        }
        row += 22
        fill(NSRect(x: left, y: row, width: bounds.width * 0.66, height: 5),
             palette.nsColor(.tertiaryText), radius: 2)
        // Hairline border.
        palette.nsColor(.border).setStroke()
        let border = NSBezierPath(rect: bounds.insetBy(dx: 0.5, dy: 0.5))
        border.lineWidth = 1
        border.stroke()
    }
}

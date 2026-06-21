import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// A live sample of a theme. Renders an app-chrome mock (window background,
    /// primary/secondary text, an accent button, a selection strip) plus the 16
    /// ANSI swatches and a small terminal line — so the user sees the theme's
    /// effect on both app UI and terminal text. Call `show(_:)` to update it.
    @MainActor
    public final class ThemePreviewView: NSView, SettingsViewProtocol {

        private let container = NSStackView()

        public init(theme: ColorTheme? = nil) {
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.container.orientation = .vertical
            self.container.alignment = .leading
            self.container.spacing = 10
            self.container.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.container)
            Self.pinToEdges(self.container, of: self)

            if let theme { self.show(theme) }
        }

        public required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        /// Renders the preview for `theme`.
        public func show(_ theme: ColorTheme) {
            let palette = SemanticPalette(theme: theme)
            self.container.arrangedSubviews.forEach { $0.removeFromSuperview() }
            self.container.addArrangedSubview(self.makeChromeSample(palette))
            self.container.addArrangedSubview(SwatchGridView(colors: palette.ansiColors, columns: 8))
            self.container.addArrangedSubview(self.makeTerminalSample(theme, palette))
        }

        // MARK: - App-chrome sample

        private func makeChromeSample(_ palette: SemanticPalette) -> NSView {
            let box = Self.roundedBox(fill: palette.nsColor(.surface))

            let title = Self.label("Window Title", color: palette.nsColor(.primaryText),
                                   font: .systemFont(ofSize: 13, weight: .semibold))
            let subtitle = Self.label("Secondary caption text", color: palette.nsColor(.secondaryText),
                                      font: .systemFont(ofSize: 11))

            let button = Self.pill("Button", fill: palette.color(.accent))
            let selection = Self.pill("Selected", fill: palette.color(.selection),
                                      textColor: palette.nsColor(.selectionText))
            let controls = NSStackView(views: [button, selection])
            controls.orientation = .horizontal
            controls.spacing = 8

            let stack = NSStackView(views: [title, subtitle, controls])
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 4
            stack.translatesAutoresizingMaskIntoConstraints = false
            box.addSubview(stack)
            NSLayoutConstraint.activate([
                stack.topAnchor.constraint(equalTo: box.topAnchor, constant: 10),
                stack.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 12),
                stack.trailingAnchor.constraint(lessThanOrEqualTo: box.trailingAnchor, constant: -12),
                stack.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -10),
                box.widthAnchor.constraint(greaterThanOrEqualToConstant: 260)
            ])
            return box
        }

        // MARK: - Terminal sample

        private func makeTerminalSample(_ theme: ColorTheme, _ palette: SemanticPalette) -> NSView {
            let box = Self.roundedBox(fill: NSColor(theme.background))
            let mono = NSFont.monospacedSystemFont(ofSize: 11, weight: .regular)

            let prompt = Self.label("user@mac ~ % ls", color: NSColor(theme.foreground), font: mono)
            let accent = palette.nsColor(.accent)
            let dir = Self.label("Documents", color: accent, font: mono)
            let file = Self.label("README.md", color: NSColor(theme.foreground), font: mono)
            let row = NSStackView(views: [dir, file])
            row.orientation = .horizontal
            row.spacing = 10

            let stack = NSStackView(views: [prompt, row])
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 2
            stack.translatesAutoresizingMaskIntoConstraints = false
            box.addSubview(stack)
            NSLayoutConstraint.activate([
                stack.topAnchor.constraint(equalTo: box.topAnchor, constant: 8),
                stack.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 10),
                stack.trailingAnchor.constraint(lessThanOrEqualTo: box.trailingAnchor, constant: -10),
                stack.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -8),
                box.widthAnchor.constraint(greaterThanOrEqualToConstant: 260)
            ])
            return box
        }

        // MARK: - Building blocks

        private static func roundedBox(fill: NSColor) -> NSView {
            let box = NSView()
            box.wantsLayer = true
            box.layer?.cornerRadius = 8
            box.layer?.backgroundColor = fill.cgColor
            box.translatesAutoresizingMaskIntoConstraints = false
            return box
        }

        private static func label(_ text: String, color: NSColor, font: NSFont) -> NSTextField {
            let label = NSTextField(labelWithString: text)
            label.textColor = color
            label.font = font
            label.translatesAutoresizingMaskIntoConstraints = false
            return label
        }

        private static func pill(_ text: String, fill: RGBAColor, textColor: NSColor? = nil) -> NSView {
            let pill = NSView()
            pill.wantsLayer = true
            pill.layer?.cornerRadius = 5
            pill.layer?.backgroundColor = NSColor(fill).cgColor
            pill.translatesAutoresizingMaskIntoConstraints = false

            let resolved = textColor ?? (fill.isDark ? .white : .black)
            let label = self.label(text, color: resolved, font: .systemFont(ofSize: 11, weight: .medium))
            pill.addSubview(label)
            NSLayoutConstraint.activate([
                label.topAnchor.constraint(equalTo: pill.topAnchor, constant: 3),
                label.bottomAnchor.constraint(equalTo: pill.bottomAnchor, constant: -3),
                label.leadingAnchor.constraint(equalTo: pill.leadingAnchor, constant: 10),
                label.trailingAnchor.constraint(equalTo: pill.trailingAnchor, constant: -10)
            ])
            return pill
        }
    }
}

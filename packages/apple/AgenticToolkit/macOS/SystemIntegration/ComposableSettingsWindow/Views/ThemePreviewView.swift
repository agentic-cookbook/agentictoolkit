import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// A live sample of a theme. Renders an app-chrome mock — window background,
    /// a surface panel with title/body/caption text at their themed **fonts**, an
    /// accent button (on-accent text), a selection chip, a divider, and an
    /// elevated **outlined** sub-panel — plus the 16 ANSI swatches and a
    /// monospaced terminal line. So the user sees the theme's colors *and*
    /// typography on real app UI. Call `show(_:)` to update it.
    @MainActor
    public final class ThemePreviewView: NSView, SettingsViewProtocol {

        private let container = NSStackView()

        public init(theme: ColorTheme? = nil) {
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false
            self.wantsLayer = true

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
            // The preview's own backdrop is the window background, so panels read
            // against the real chrome color.
            self.layer?.backgroundColor = palette.nsColor(.windowBackground).cgColor
            self.container.arrangedSubviews.forEach { $0.removeFromSuperview() }
            self.container.addArrangedSubview(self.makeChromeSample(palette))
            self.container.addArrangedSubview(SwatchGridView(colors: palette.ansiColors, columns: 8))
            self.container.addArrangedSubview(self.makeTerminalSample(palette))
        }

        // MARK: - App-chrome sample

        private func makeChromeSample(_ palette: SemanticPalette) -> NSView {
            let box = Self.roundedBox(fill: palette.nsColor(.surface))

            let title = Self.label("Window Title", color: palette.nsColor(.primaryText),
                                   font: palette.font(.title))
            let body = Self.label("Body text in the body font.", color: palette.nsColor(.primaryText),
                                  font: palette.font(.body))
            let caption = Self.label("Secondary caption text", color: palette.nsColor(.secondaryText),
                                     font: palette.font(.caption))

            let button = Self.pill("Button", fill: palette.color(.accent),
                                   textColor: palette.nsColor(.onAccentText), font: palette.font(.button))
            let selection = Self.pill("Selected", fill: palette.color(.selection),
                                      textColor: palette.nsColor(.selectionText), font: palette.font(.button))
            let controls = NSStackView(views: [button, selection])
            controls.orientation = .horizontal
            controls.spacing = 8

            let divider = Self.hairline(palette.nsColor(.divider))

            // Elevated, outlined sub-panel to showcase elevatedSurface + outline.
            let inner = Self.roundedBox(fill: palette.nsColor(.elevatedSurface))
            inner.layer?.borderWidth = 1
            inner.layer?.borderColor = palette.nsColor(.outline).cgColor
            let innerLabel = Self.label("Panel · outline", color: palette.nsColor(.tertiaryText),
                                        font: palette.font(.caption))
            inner.addSubview(innerLabel)
            NSLayoutConstraint.activate([
                innerLabel.topAnchor.constraint(equalTo: inner.topAnchor, constant: 6),
                innerLabel.bottomAnchor.constraint(equalTo: inner.bottomAnchor, constant: -6),
                innerLabel.leadingAnchor.constraint(equalTo: inner.leadingAnchor, constant: 10),
                innerLabel.trailingAnchor.constraint(equalTo: inner.trailingAnchor, constant: -10)
            ])

            let stack = NSStackView(views: [title, body, caption, controls, divider, inner])
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 6
            stack.translatesAutoresizingMaskIntoConstraints = false
            box.addSubview(stack)
            NSLayoutConstraint.activate([
                stack.topAnchor.constraint(equalTo: box.topAnchor, constant: 10),
                stack.leadingAnchor.constraint(equalTo: box.leadingAnchor, constant: 12),
                stack.trailingAnchor.constraint(equalTo: box.trailingAnchor, constant: -12),
                stack.bottomAnchor.constraint(equalTo: box.bottomAnchor, constant: -10),
                box.widthAnchor.constraint(greaterThanOrEqualToConstant: 280),
                divider.widthAnchor.constraint(equalTo: stack.widthAnchor)
            ])
            return box
        }

        // MARK: - Terminal sample

        private func makeTerminalSample(_ palette: SemanticPalette) -> NSView {
            let box = Self.roundedBox(fill: palette.nsColor(.windowBackground))
            box.layer?.borderWidth = 1
            box.layer?.borderColor = palette.nsColor(.border).cgColor
            let mono = palette.font(.code)

            let prompt = Self.label("user@mac ~ % ls", color: palette.nsColor(.primaryText), font: mono)
            let dir = Self.label("Documents", color: palette.nsColor(.accent), font: mono)
            let file = Self.label("README.md", color: palette.nsColor(.secondaryText), font: mono)
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
                box.widthAnchor.constraint(greaterThanOrEqualToConstant: 280)
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

        private static func hairline(_ color: NSColor) -> NSView {
            let line = NSView()
            line.wantsLayer = true
            line.layer?.backgroundColor = color.cgColor
            line.translatesAutoresizingMaskIntoConstraints = false
            line.heightAnchor.constraint(equalToConstant: 1).isActive = true
            return line
        }

        private static func label(_ text: String, color: NSColor, font: NSFont) -> NSTextField {
            let label = NSTextField(labelWithString: text)
            label.textColor = color
            label.font = font
            label.translatesAutoresizingMaskIntoConstraints = false
            return label
        }

        private static func pill(
            _ text: String, fill: RGBAColor, textColor: NSColor, font: NSFont
        ) -> NSView {
            let pill = NSView()
            pill.wantsLayer = true
            pill.layer?.cornerRadius = 5
            pill.layer?.backgroundColor = NSColor(fill).cgColor
            pill.translatesAutoresizingMaskIntoConstraints = false

            let label = self.label(text, color: textColor, font: font)
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

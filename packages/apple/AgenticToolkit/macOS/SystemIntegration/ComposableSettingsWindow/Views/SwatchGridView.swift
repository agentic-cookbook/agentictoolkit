import AppKit

extension ComposableSettings {

    /// A reusable grid of color swatches, laid out in fixed-width rows. Generalizes
    /// the ad-hoc swatch/ANSI grid the terminal profiles view used to build inline.
    @MainActor
    public final class SwatchGridView: NSView, SettingsViewProtocol {

        private let columns: Int
        private let swatchSize: CGSize
        private let spacing: CGFloat
        private let container = NSStackView()
        private var colors: [NSColor]

        public init(
            colors: [NSColor] = [],
            columns: Int = 8,
            swatchSize: CGSize = CGSize(width: 22, height: 22),
            spacing: CGFloat = 4
        ) {
            self.colors = colors
            self.columns = Swift.max(1, columns)
            self.swatchSize = swatchSize
            self.spacing = spacing

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.container.orientation = .vertical
            self.container.alignment = .leading
            self.container.spacing = spacing
            self.container.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.container)
            Self.pinToEdges(self.container, of: self)

            self.rebuild()
        }

        public required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        /// Replaces the displayed colors and relays out.
        public func setColors(_ colors: [NSColor]) {
            self.colors = colors
            self.rebuild()
        }

        private func rebuild() {
            self.container.arrangedSubviews.forEach { $0.removeFromSuperview() }
            var index = 0
            while index < self.colors.count {
                let row = NSStackView()
                row.orientation = .horizontal
                row.spacing = self.spacing
                let upper = Swift.min(index + self.columns, self.colors.count)
                for color in self.colors[index..<upper] {
                    row.addArrangedSubview(self.makeSwatch(color))
                }
                self.container.addArrangedSubview(row)
                index += self.columns
            }
        }

        private func makeSwatch(_ color: NSColor) -> NSView {
            let swatch = NSView()
            swatch.wantsLayer = true
            swatch.layer?.cornerRadius = 3
            swatch.layer?.backgroundColor = color.cgColor
            swatch.layer?.borderWidth = 0.5
            swatch.layer?.borderColor = NSColor.separatorColor.cgColor
            swatch.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                swatch.widthAnchor.constraint(equalToConstant: self.swatchSize.width),
                swatch.heightAnchor.constraint(equalToConstant: self.swatchSize.height)
            ])
            return swatch
        }
    }
}

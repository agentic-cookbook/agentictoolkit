import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    @MainActor
    public class HeaderView: NSView, SettingsViewProtocol {
        public let titleLabel: NSTextField

        private var themeObserver: ThemePaletteObserver?

        public init(title: String) {
            self.titleLabel = Self.createHeaderLabel(title: title)
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.titleLabel.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.titleLabel)

            NSLayoutConstraint.activate([
                self.titleLabel.topAnchor.constraint(equalTo: self.topAnchor),
                self.titleLabel.leadingAnchor.constraint(equalTo: self.leadingAnchor),
                self.titleLabel.trailingAnchor.constraint(equalTo: self.trailingAnchor),
                self.titleLabel.bottomAnchor.constraint(equalTo: self.bottomAnchor)
            ])

            themeObserver = ThemePaletteObserver { [weak self] palette in
                self?.applyTheme(palette)
            }
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        private func applyTheme(_ palette: SemanticPalette) {
            titleLabel.textColor = palette.secondaryTextColor
            titleLabel.font = palette.font(.caption)
        }

        static func createHeaderLabel(title: String) -> NSTextField {
            let label = NSTextField(labelWithString: title)
            label.font = .systemFont(ofSize: 13, weight: .semibold)
            label.isEditable = false
            return label
        }
    }
}

import AppKit

extension ComposableSettings {

    @MainActor
    public class HeaderView: NSView {
        public let titleLabel: NSTextField

        private let viewLayout: SettingsLayout

        public init(title: String, viewLayout: SettingsLayout = .default) {
            self.viewLayout = viewLayout
            self.titleLabel = Self.createHeaderLabel(title: title)
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.titleLabel.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.titleLabel)

            NSLayoutConstraint.activate([
                self.titleLabel.topAnchor.constraint(equalTo: self.topAnchor),
                self.titleLabel.leadingAnchor.constraint(equalTo: self.leadingAnchor),
                self.titleLabel.trailingAnchor.constraint(equalTo: self.trailingAnchor),
                self.titleLabel.bottomAnchor.constraint(equalTo: self.bottomAnchor),
            ])
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        static func createHeaderLabel(title: String) -> NSTextField {
            let label = NSTextField(labelWithString: title)
            label.font = .systemFont(ofSize: 13, weight: .semibold)
            label.isEditable = false
            return label
        }
    }
}

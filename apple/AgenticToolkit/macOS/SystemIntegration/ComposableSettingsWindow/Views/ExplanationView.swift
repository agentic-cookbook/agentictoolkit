import AppKit

extension ComposableSettings {

    /// Small descriptive blurb rendered beneath a setting.
    @MainActor
    public class ExplanationView: NSView, SettingsViewProtocol {
        public let label: NSTextField

        

        public init(withText text: String) {
            self.label = Self.createLabel(title: text)
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.label.translatesAutoresizingMaskIntoConstraints = false
            self.label.lineBreakMode = .byWordWrapping
            self.label.maximumNumberOfLines = 0
            self.label.setContentCompressionResistancePriority(.required, for: .vertical)
            self.addSubview(self.label)

            NSLayoutConstraint.activate([
                self.label.topAnchor.constraint(equalTo: self.topAnchor),
                self.label.leadingAnchor.constraint(equalTo: self.leadingAnchor),
                self.label.trailingAnchor.constraint(equalTo: self.trailingAnchor),
                self.label.bottomAnchor.constraint(equalTo: self.bottomAnchor),
            ])
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        static func createLabel(title: String) -> NSTextField {
            let label = NSTextField(labelWithString: title)
            label.font = .systemFont(ofSize: 11, weight: .regular)
            label.textColor = .secondaryLabelColor
            return label
        }
    }
}

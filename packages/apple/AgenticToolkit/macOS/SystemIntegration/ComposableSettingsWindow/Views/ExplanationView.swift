import AppKit
import AgenticToolkitCore

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
            // A wrapping label still reports its one-line intrinsic width unless it
            // is allowed to yield horizontally — otherwise a long blurb forces the
            // whole panel (and the settings window) as wide as the text. Let it be
            // compressed so it wraps to the available width instead.
            self.label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
            self.label.setContentHuggingPriority(.defaultLow, for: .horizontal)
            self.addSubview(self.label)

            NSLayoutConstraint.activate([
                self.label.topAnchor.constraint(equalTo: self.topAnchor),
                self.label.leadingAnchor.constraint(equalTo: self.leadingAnchor),
                self.label.trailingAnchor.constraint(equalTo: self.trailingAnchor),
                self.label.bottomAnchor.constraint(equalTo: self.bottomAnchor)
            ])
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        static func createLabel(title: String) -> NSTextField {
            let label = ComposableSettings.makeValueLabel(title)
            return label
        }
    }
}

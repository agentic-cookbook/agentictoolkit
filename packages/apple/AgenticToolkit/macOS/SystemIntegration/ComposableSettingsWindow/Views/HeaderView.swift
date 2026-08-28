import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    @MainActor
    public class HeaderView: NSView, SettingsViewProtocol {
        public let titleLabel: ThemedLabel

        public init(title: String) {
            self.titleLabel = ThemedLabel(string: title, role: .secondaryText, textRole: .caption)
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
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }
    }
}

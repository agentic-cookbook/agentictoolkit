import AppKit

extension ComposableSettings {

    @MainActor
    public class HorizontalStackView: NSView, SettingsViewProtocol {
        private let stackView: NSStackView

        public convenience init() {
            self.init(frame: .zero)
        }

        public override init(frame frameRect: NSRect) {
            self.stackView = NSStackView()
            self.stackView.orientation = .horizontal
            self.stackView.spacing = SettingsLayout.default[.groupSpacing]

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.stackView.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.stackView)
            Self.pinToEdges(self.stackView, of: self)
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        public func addArrangedSubview(_ view: NSView) {
            self.stackView.addArrangedSubview(view)
        }
    }
}

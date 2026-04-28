import AppKit

extension ComposableSettings {

    @MainActor
    public class VerticalStackView: NSView {
        public let stackView: NSStackView

        private let viewLayout: SettingsLayout

        public init(viewLayout: SettingsLayout = .default) {
            self.viewLayout = viewLayout
            self.stackView = NSStackView()
            self.stackView.orientation = .vertical
            self.stackView.spacing = viewLayout[.groupSpacing]

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.stackView.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.stackView)
            Self.pinToEdges(self.stackView, of: self)
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        public func addArrangedSubview(_ view: NSView) {
            self.stackView.addArrangedSubview(view)
        }
    }
}

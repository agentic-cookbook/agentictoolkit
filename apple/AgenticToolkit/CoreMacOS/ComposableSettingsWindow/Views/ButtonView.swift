import AppKit

extension ComposableSettings {

    @MainActor
    public class ButtonView: NSView {
        public let button: NSButton

        private let viewModel: ButtonViewModel
        private let viewLayout: SettingsLayout

        public init(viewModel: ButtonViewModel, viewLayout: SettingsLayout = .default) {
            self.viewModel = viewModel
            self.viewLayout = viewLayout
            self.button = NSButton(title: viewModel.title, target: nil, action: nil)

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.button.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.button)
            Self.pinToEdges(self.button, of: self)

            self.button.target = self
            self.button.action = #selector(buttonWasPressed(_:))
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        @objc private func buttonWasPressed(_ sender: NSButton) {
            viewModel.wasPressedCallback?()
        }
    }
}

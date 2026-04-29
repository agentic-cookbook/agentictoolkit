import AppKit

extension ComposableSettings {

    @MainActor
    public class TextEditView: NSView, SettingsViewProtocol {
        public let label: NSTextField
        public let textField: NSTextField

        private let viewModel: ViewModel<String>
        

        public init(with viewModel: ViewModel<String>) {
            self.viewModel = viewModel
            self.label = Self.createLabel(title: viewModel.title)
            self.textField = Self.makeTextField(initialValue: viewModel.value)

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            let row = Self.makeRow([self.label, self.textField])
            self.addSubview(row)
            Self.pinToEdges(row, of: self)

            self.textField.target = self
            self.textField.action = #selector(textFieldChanged(_:))

            viewModel.onChange = { [weak self] _ in
                guard let self else { return }
                self.label.stringValue = viewModel.title
                self.textField.stringValue = viewModel.value
            }
        }

        @objc private func textFieldChanged(_ sender: NSTextField) {
            let newValue = sender.stringValue
            if viewModel.settingObserver.value != newValue {
                viewModel.settingObserver.value = newValue
            }
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        static func createLabel(title: String) -> NSTextField {
            let label = NSTextField(labelWithString: title)
            label.font = .systemFont(ofSize: 13, weight: .semibold)
            return label
        }

        /// Override to substitute a different `NSTextField` subclass — e.g.
        /// `SecureTextEditView` returns an `NSSecureTextField`.
        open class func makeTextField(initialValue: String) -> NSTextField {
            NSTextField(string: initialValue)
        }
    }
}

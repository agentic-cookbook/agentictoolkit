import AppKit

extension ComposableSettings {

    @MainActor
    public class CheckboxView: NSView {
        public let label: NSTextField
        public let checkbox: NSButton

        private let viewModel: ViewModel<Bool>
        private let viewLayout: SettingsLayout

        public init(with viewModel: ViewModel<Bool>, viewLayout: SettingsLayout = .default) {
            self.viewModel = viewModel
            self.viewLayout = viewLayout
            self.label = Self.createLabel(title: viewModel.title)
            self.checkbox = NSButton(checkboxWithTitle: "", target: nil, action: nil)

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            let row = Self.makeRow([self.checkbox, self.label], viewLayout: viewLayout)
            self.addSubview(row)
            Self.pinToEdges(row, of: self)

            self.checkbox.target = self
            self.checkbox.action = #selector(checkboxChanged(_:))

            viewModel.onChange = { [weak self] _ in
                self?.update()
            }

            self.update()
        }

        @objc private func checkboxChanged(_ sender: NSButton) {
            let newValue = (sender.state == .on)
            if viewModel.settingObserver.value != newValue {
                viewModel.settingObserver.value = newValue
            }
        }

        private func update() {
            self.label.stringValue = viewModel.title
            self.checkbox.state = viewModel.value ? .on : .off
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
    }
}

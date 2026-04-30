import AppKit

extension ComposableSettings {

    @MainActor
    public class PopupMenuChoiceView<Value: Codable & Sendable & Equatable>: NSView, SettingsViewProtocol {
        public let label: NSTextField
        public let popUpButton: NSPopUpButton

        private let viewModel: ChoiceViewModel<Value>

        public init(viewModel: ChoiceViewModel<Value>) {
            self.viewModel = viewModel
            self.label = Self.createLabel(title: viewModel.title)
            self.popUpButton = NSPopUpButton(frame: .zero)

            for choice in viewModel.choices {
                self.popUpButton.addItem(withTitle: choice.label)
                self.popUpButton.lastItem?.representedObject = choice.value
                if let symbol = choice.imageSystemName {
                    self.popUpButton.lastItem?.image =
                        NSImage(systemSymbolName: symbol, accessibilityDescription: nil)
                }
            }

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            let row = Self.makeRow([self.label, self.popUpButton])
            self.addSubview(row)
            Self.pinToEdges(row, of: self)

            self.popUpButton.target = self
            self.popUpButton.action = #selector(popupChanged(_:))

            viewModel.onChange = { [weak self] _ in
                self?.syncSelection()
            }

            self.syncSelection()
        }

        private func syncSelection() {
            self.label.stringValue = viewModel.title
            let current = viewModel.value
            if let index = viewModel.choices.firstIndex(where: { $0.value == current }) {
                self.popUpButton.selectItem(at: index)
            }
        }

        @objc private func popupChanged(_ sender: NSPopUpButton) {
            guard let value = sender.selectedItem?.representedObject as? Value else { return }
            if viewModel.settingObserver.value != value {
                viewModel.settingObserver.value = value
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
    }
}

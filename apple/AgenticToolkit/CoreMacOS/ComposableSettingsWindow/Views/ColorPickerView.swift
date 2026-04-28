import AppKit

extension ComposableSettings {

    @MainActor
    public class ColorPickerView: NSView {
        public let label: NSTextField
        public let colorWell: NSColorWell

        private let viewModel: ColorViewModel
        private let viewLayout: SettingsLayout

        public init(viewModel: ColorViewModel, viewLayout: SettingsLayout = .default) {
            self.viewModel = viewModel
            self.viewLayout = viewLayout
            self.label = Self.createLabel(title: viewModel.title)
            self.colorWell = NSColorWell()
            self.colorWell.color = viewModel.color

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            let row = Self.makeRow([self.label, self.colorWell], viewLayout: viewLayout)
            self.addSubview(row)
            Self.pinToEdges(row, of: self)

            self.colorWell.target = self
            self.colorWell.action = #selector(colorChanged(_:))

            viewModel.onChange = { [weak self] _ in
                guard let self else { return }
                self.label.stringValue = viewModel.title
                self.colorWell.color = viewModel.color
            }
        }

        @objc private func colorChanged(_ sender: NSColorWell) {
            viewModel.color = sender.color
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

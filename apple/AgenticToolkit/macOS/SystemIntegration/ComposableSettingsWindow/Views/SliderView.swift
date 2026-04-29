import AppKit

extension ComposableSettings {

    @MainActor
    public class SliderView: NSView, SettingsViewProtocol {
        public let label: NSTextField
        public let slider: NSSlider

        private let viewModel: RangeViewModel<Double>
        

        public init(viewModel: RangeViewModel<Double>) {
            self.viewModel = viewModel
            self.label = Self.createLabel(title: viewModel.title)
            self.slider = NSSlider()

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.slider.maxValue = viewModel.maxValue
            self.slider.minValue = viewModel.minValue
            self.slider.doubleValue = viewModel.value
            self.slider.target = self
            self.slider.action = #selector(sliderChanged(_:))

            let row = Self.makeRow([self.label, self.slider])
            self.addSubview(row)
            Self.pinToEdges(row, of: self)

            viewModel.onChange = { [weak self] _ in
                guard let self else { return }
                self.label.stringValue = viewModel.title
                self.slider.maxValue = viewModel.maxValue
                self.slider.minValue = viewModel.minValue
                self.slider.doubleValue = viewModel.value
            }
        }

        @objc private func sliderChanged(_ sender: NSSlider) {
            let newValue = sender.doubleValue
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
    }
}

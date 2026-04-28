import AppKit

extension ComposableSettings {

    /// Slider with a live trailing caption derived from the current value via a
    /// caller-supplied formatter (e.g. `{ "\(Int($0 * 100))%" }` or
    /// `{ "\(Int($0))s" }`). Use when the slider's raw position isn't enough
    /// to identify the current value.
    @MainActor
    public class CaptionedSliderView: NSView {
        public let label: NSTextField
        public let slider: NSSlider
        public let captionLabel: NSTextField

        private let viewModel: RangeViewModel<Double>
        private let viewLayout: SettingsLayout
        private let formatter: @MainActor (Double) -> String

        public init(
            viewModel: RangeViewModel<Double>,
            viewLayout: SettingsLayout = .default,
            formatter: @escaping @MainActor (Double) -> String
        ) {
            self.viewModel = viewModel
            self.viewLayout = viewLayout
            self.formatter = formatter
            self.label = Self.createLabel(title: viewModel.title)
            self.slider = NSSlider()
            self.captionLabel = Self.createCaption()

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.slider.maxValue = viewModel.maxValue
            self.slider.minValue = viewModel.minValue
            self.slider.doubleValue = viewModel.value
            self.slider.target = self
            self.slider.action = #selector(sliderChanged(_:))

            let row = Self.makeRow(
                [self.label, self.slider, self.captionLabel],
                viewLayout: viewLayout
            )
            self.addSubview(row)
            Self.pinToEdges(row, of: self)

            viewModel.onChange = { [weak self] _ in
                self?.sync()
            }

            self.sync()
        }

        private func sync() {
            self.label.stringValue = viewModel.title
            self.slider.doubleValue = viewModel.value
            self.captionLabel.stringValue = formatter(viewModel.value)
        }

        @objc private func sliderChanged(_ sender: NSSlider) {
            let newValue = sender.doubleValue
            self.captionLabel.stringValue = formatter(newValue)
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

        static func createCaption() -> NSTextField {
            let label = NSTextField(labelWithString: "")
            label.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
            label.textColor = .secondaryLabelColor
            label.setContentCompressionResistancePriority(.required, for: .horizontal)
            return label
        }
    }
}

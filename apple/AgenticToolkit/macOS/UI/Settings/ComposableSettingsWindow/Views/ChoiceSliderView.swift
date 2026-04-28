import AppKit

extension ComposableSettings {

    /// Discrete-tick slider bound to a `ChoiceViewModel`. Each tick position
    /// corresponds to one entry in `viewModel.choices`; the slider snaps to
    /// ticks only. The current choice's `label` is shown as a secondary
    /// caption to the right of the slider.
    @MainActor
    public class ChoiceSliderView<Value: Codable & Sendable & Equatable>: NSView {
        public let label: NSTextField
        public let slider: NSSlider
        public let valueLabel: NSTextField

        private let viewModel: ChoiceViewModel<Value>
        private let viewLayout: SettingsLayout

        public init(viewModel: ChoiceViewModel<Value>, viewLayout: SettingsLayout = .default) {
            self.viewModel = viewModel
            self.viewLayout = viewLayout
            self.label = Self.createLabel(title: viewModel.title)
            self.slider = NSSlider()
            self.valueLabel = Self.createValueLabel()

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            let count = viewModel.choices.count
            self.slider.minValue = 0
            self.slider.maxValue = Double(max(count - 1, 0))
            self.slider.numberOfTickMarks = count
            self.slider.allowsTickMarkValuesOnly = true
            self.slider.target = self
            self.slider.action = #selector(sliderChanged(_:))

            let row = Self.makeRow(
                [self.label, self.slider, self.valueLabel],
                viewLayout: viewLayout
            )
            self.addSubview(row)
            Self.pinToEdges(row, of: self)

            viewModel.onChange = { [weak self] _ in
                self?.syncSelection()
            }

            self.syncSelection()
        }

        private func syncSelection() {
            self.label.stringValue = viewModel.title
            let current = viewModel.value
            if let index = viewModel.choices.firstIndex(where: { $0.value == current }) {
                self.slider.doubleValue = Double(index)
                self.valueLabel.stringValue = viewModel.choices[index].label
            }
        }

        @objc private func sliderChanged(_ sender: NSSlider) {
            let index = Int(sender.doubleValue.rounded())
            guard viewModel.choices.indices.contains(index) else { return }
            let value = viewModel.choices[index].value
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

        static func createValueLabel() -> NSTextField {
            let label = NSTextField(labelWithString: "")
            label.font = .systemFont(ofSize: 11)
            label.textColor = .secondaryLabelColor
            return label
        }
    }
}

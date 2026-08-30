import AppKit
import AgenticToolkitCore

extension ComposableSettings {

    /// A short label and a narrow integer text field, clamped to the view
    /// model's range.
    ///
    /// A slider is the wrong control for a number the user already knows —
    /// "12 points on the left" is typed, not dragged — and `StepperView` makes
    /// you click twelve times to say it.
    @MainActor
    public final class IntegerFieldView: NSView, SettingsViewProtocol, NSTextFieldDelegate {

        public let label: NSTextField
        public let textField: NSTextField

        private let viewModel: RangeViewModel<Int>

        public init(viewModel: RangeViewModel<Int>, fieldWidth: CGFloat = 52) {
            self.viewModel = viewModel
            self.label = ComposableSettings.makeRowLabel(viewModel.title)
            self.textField = NSTextField()

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            let formatter = NumberFormatter()
            formatter.numberStyle = .none
            formatter.allowsFloats = false
            formatter.minimum = NSNumber(value: viewModel.minValue)
            formatter.maximum = NSNumber(value: viewModel.maxValue)
            self.textField.formatter = formatter
            self.textField.alignment = .right
            self.textField.integerValue = viewModel.value
            self.textField.target = self
            self.textField.action = #selector(fieldChanged(_:))
            self.textField.delegate = self
            self.textField.observeTheme { field, palette in
                field.font = palette.font(.code)
                field.textColor = palette.primaryTextColor
            }

            let row = Self.makeRow([self.label, self.textField])
            self.addSubview(row)
            Self.pinToEdges(row, of: self)

            NSLayoutConstraint.activate([
                self.textField.widthAnchor.constraint(equalToConstant: fieldWidth)
            ])

            viewModel.onChange = { [weak self] _ in self?.sync() }
            self.sync()
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect)")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        private func sync() {
            label.stringValue = viewModel.title
            textField.integerValue = viewModel.value
        }

        /// Committing on every keystroke would fight the user mid-number (a "1"
        /// on the way to "12"), so the value is written when editing ends —
        /// which covers Return, Tab and clicking away.
        public func controlTextDidEndEditing(_ obj: Notification) {
            commit()
        }

        @objc private func fieldChanged(_ sender: NSTextField) {
            commit()
        }

        private func commit() {
            let clamped = min(max(textField.integerValue, viewModel.minValue), viewModel.maxValue)
            if textField.integerValue != clamped {
                textField.integerValue = clamped
            }
            if viewModel.settingObserver.value != clamped {
                viewModel.settingObserver.value = clamped
            }
        }
    }
}

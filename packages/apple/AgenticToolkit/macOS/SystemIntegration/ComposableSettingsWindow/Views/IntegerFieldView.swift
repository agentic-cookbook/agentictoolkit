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

        /// - Parameters:
        ///   - fieldWidth: Width of the number field.
        ///   - labelWidth: When set, the label is pinned to this width and
        ///     right-aligned. That is what lets a *column* of these read as one
        ///     form — four sides of a padding box, say — with the fields lined
        ///     up under each other instead of stepping in and out with the
        ///     length of each name.
        public init(
            viewModel: RangeViewModel<Int>,
            fieldWidth: CGFloat = 52,
            labelWidth: CGFloat? = nil
        ) {
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

            NSLayoutConstraint.activate([
                self.textField.widthAnchor.constraint(equalToConstant: fieldWidth)
            ])

            if let labelWidth {
                self.label.alignment = .right
                self.label.widthAnchor.constraint(equalToConstant: labelWidth).isActive = true
                // Content-width row rather than a pinned one: pinned to both
                // edges the stack would spread its two fixed-width children
                // across whatever the panel is wide, and the field would drift
                // away from the label it belongs to.
                NSLayoutConstraint.activate([
                    row.topAnchor.constraint(equalTo: self.topAnchor),
                    row.leadingAnchor.constraint(equalTo: self.leadingAnchor),
                    row.bottomAnchor.constraint(equalTo: self.bottomAnchor),
                    row.trailingAnchor.constraint(lessThanOrEqualTo: self.trailingAnchor)
                ])
            } else {
                Self.pinToEdges(row, of: self)
            }

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

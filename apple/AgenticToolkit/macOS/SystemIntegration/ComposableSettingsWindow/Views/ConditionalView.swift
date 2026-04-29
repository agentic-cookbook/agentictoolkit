import AppKit
import AgenticToolkitCore
import Combine

extension ComposableSettings {

    /// Container that shows or hides its child based on the live value of a
    /// `UserSetting`. The visibility predicate is evaluated whenever the
    /// setting publishes a change.
    ///
    /// Example: show a "Custom Command" group only when the click-action
    /// setting equals `.customCommand`:
    ///
    /// ```swift
    /// ConditionalView(
    ///     observing: UserSettings.clickAction,
    ///     child: customCommandGroup
    /// ) { $0 == "custom_command" }
    /// ```
    @MainActor
    public class ConditionalView<Value: Codable & Sendable>: NSView {
        public let child: NSView

        private let observer: UserSettingObserver<Value>
        private let isVisible: @MainActor (Value) -> Bool

        public init(
            observing setting: UserSetting<Value>,
            child: NSView,
            isVisible: @escaping @MainActor (Value) -> Bool
        ) {
            self.child = child
            self.observer = UserSettingObserver(setting)
            self.isVisible = isVisible

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.child.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.child)
            Self.pinToEdges(self.child, of: self)

            self.observer.onChange = { [weak self] newValue in
                self?.applyVisibility(for: newValue)
            }

            self.applyVisibility(for: observer.value)
        }

        private func applyVisibility(for value: Value) {
            self.isHidden = !isVisible(value)
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }
    }
}

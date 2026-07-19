import AgenticToolkitCore

extension ComposableSettings {

    public class ChoiceViewModel<Value: Codable & Sendable & Equatable>: ViewModel<Value> {

        public let choices: [Choice]

        public init(
            title: String,
            setting: UserSetting<Value>,
            choices: [Choice],
            explanation: String? = nil
        ) {
            self.choices = choices
            super.init(title: title, setting: setting, explanation: explanation)
        }
    }
}

extension ComposableSettings.ChoiceViewModel {

    /// A label/value pair for a `ChoiceViewModel`. Optionally carries a system
    /// symbol name; views that support iconography render it next to the label.
    public struct Choice: Sendable {
        public let label: String
        public let value: Value
        public let imageSystemName: String?

        public init(label: String, value: Value, imageSystemName: String? = nil) {
            self.label = label
            self.value = value
            self.imageSystemName = imageSystemName
        }
    }
}

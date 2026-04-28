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
    
    /// A label/value pair for a `ChoiceViewModel`.
    public struct Choice: Sendable {
        public let label: String
        public let value: Value

        public init(label: String, value: Value) {
            self.label = label
            self.value = value
        }
    }
}

import AgenticToolkitCore

extension ComposableSettings {

    public class ViewModel<Value: Codable & Sendable>: AbstractViewModel {

        public let settingObserver: UserSettingObserver<Value>

        public init(
            title: String,
            setting: UserSetting<Value>,
            explanation: String? = nil
        ) {
            self.settingObserver = UserSettingObserver(setting)
            super.init(title: title, explanation: explanation)
        }

        public var onChange: ((_ newValue: Value) -> Void)? {
            get { settingObserver.onChange }
            set { settingObserver.onChange = newValue }
        }

        public var value: Value {
            settingObserver.value
        }
    }
}

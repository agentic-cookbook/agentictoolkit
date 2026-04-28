import Foundation

extension ComposableSettings {

    public class ButtonViewModel: AbstractViewModel {
        var wasPressedCallback: (() -> Void)?

        public init(
            title: String,
            explanation: String? = nil,
            wasPressedCallback: (() -> Void)? = nil
        ) {
            self.wasPressedCallback = wasPressedCallback
            super.init(title: title, explanation: explanation)
        }
    }
}

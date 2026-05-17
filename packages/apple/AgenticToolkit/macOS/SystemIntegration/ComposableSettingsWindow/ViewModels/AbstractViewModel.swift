import Foundation

extension ComposableSettings {

    @MainActor
    public class AbstractViewModel {
        public let title: String
        public let explanation: String?

        public init(
            title: String,
            explanation: String? = nil
        ) {
            self.title = title
            self.explanation = explanation
        }
    }
}

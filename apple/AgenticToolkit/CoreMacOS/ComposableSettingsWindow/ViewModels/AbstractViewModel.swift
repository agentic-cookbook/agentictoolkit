import Foundation

extension ComposableSettings {

    @MainActor
    public class AbstractViewModel {
        public let title: String
        // TODO: views do not yet render `explanation`. Surface it consistently as a follow-up.
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

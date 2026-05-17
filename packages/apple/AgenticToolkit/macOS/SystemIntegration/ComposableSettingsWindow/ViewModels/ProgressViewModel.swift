import Combine

extension ComposableSettings {

    @MainActor
    public class ProgressViewModel: AbstractViewModel {
        /// `nil` = indeterminate. Non-nil drives a determinate bar
        /// (consumer chooses the scale).
        @Published public var progress: Double?

        public init(
            title: String,
            explanation: String? = nil,
            progress: Double? = nil
        ) {
            self.progress = progress
            super.init(title: title, explanation: explanation)
        }
    }
}

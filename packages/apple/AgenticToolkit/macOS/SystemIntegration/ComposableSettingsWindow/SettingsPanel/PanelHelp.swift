import Foundation

extension ComposableSettings {

    /// The reference prose for one settings panel, rendered in the help drawer to
    /// the right of the panel rather than inline beneath its controls.
    ///
    /// Keeping it out of the panel body is the point: a blurb under every control
    /// is read once and then costs vertical space forever, which pushes the
    /// controls apart and buries the ones below the fold. In the drawer the same
    /// words are one click away and can be dismissed for good — and a panel that
    /// wants to explain more can, since the length no longer competes with the
    /// settings themselves.
    public struct PanelHelp: Sendable, Equatable {

        /// Ordered to match the panel's groups top-to-bottom, so the drawer can be
        /// read alongside the controls it describes.
        public let topics: [Topic]

        public init(topics: [Topic]) {
            self.topics = topics
        }
    }
}

extension ComposableSettings.PanelHelp {

    /// One passage of help. `title` names the group of controls the passage
    /// explains — normally the exact `GroupView` title from the panel, so the two
    /// columns line up as the reader scans down.
    public struct Topic: Sendable, Equatable {

        public let title: String
        public let body: String

        public init(title: String, body: String) {
            self.title = title
            self.body = body
        }
    }
}

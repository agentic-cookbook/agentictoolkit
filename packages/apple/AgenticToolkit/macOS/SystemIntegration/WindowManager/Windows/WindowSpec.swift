import AppKit

/// Declares the spatial rules for a managed window.
public struct WindowSpec: Codable, Sendable, Equatable {
    public let defaultSize: NSSize
    public let minSize: NSSize
    public let defaultPosition: WindowPosition
    public let persistsFrame: Bool
    public let behavior: Behavior

    public init(
        defaultSize: NSSize,
        minSize: NSSize,
        defaultPosition: WindowPosition,
        persistsFrame: Bool,
        behavior: Behavior = .default
    ) {
        self.defaultSize = defaultSize
        self.minSize = minSize
        self.defaultPosition = defaultPosition
        self.persistsFrame = persistsFrame
        self.behavior = behavior
    }
}

extension WindowSpec {

    /// Per-window switches that opt windows into (or out of) toolkit-wide
    /// systems like recents tracking and launch-time reopen.
    public struct Behavior: OptionSet, Codable, Sendable, Equatable {
        public let rawValue: Int

        public init(rawValue: Int) {
            self.rawValue = rawValue
        }

        /// Window participates in recents — the Open Recent menu for document
        /// windows, or the toolkit's window-recents tracker for non-document
        /// single windows.
        public static let includeInRecents = Behavior(rawValue: 1 << 0)

        /// Window may be re-shown at launch when the user's reopen-on-launch
        /// policy says so.
        public static let canReopenOnLaunch = Behavior(rawValue: 1 << 1)

        /// Default behavior: opt in to both recents and reopen-on-launch.
        public static let `default`: Behavior = [.includeInRecents, .canReopenOnLaunch]
    }
}

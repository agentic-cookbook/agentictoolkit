import Foundation

/// A fingerprint that identifies a window by its app and title pattern.
///
/// When a window is added to a context, a fingerprint is created from its
/// current properties. After a reboot or app restart, the fingerprint is
/// used to re-match the window to the correct context — even though the
/// CGWindowID has changed.
public struct SystemWindowFingerprint: Codable, Equatable, Sendable {
    /// The owning application's name (e.g., "Xcode", "Brave Browser").
    public let app: String

    /// A pattern extracted from the window title by an app-specific heuristic.
    /// For example, "MyProject" extracted from "MyProject — ContentView.swift".
    public let titlePattern: String

    /// How strictly to match this fingerprint against candidate windows.
    public let matchStrategy: MatchStrategy

    /// The display ID the window was originally on. Used as a tie-breaker
    /// when multiple candidate windows match.
    public let display: UInt32

    public init(
        app: String,
        titlePattern: String,
        matchStrategy: MatchStrategy,
        display: UInt32
    ) {
        self.app = app
        self.titlePattern = titlePattern
        self.matchStrategy = matchStrategy
        self.display = display
    }
}

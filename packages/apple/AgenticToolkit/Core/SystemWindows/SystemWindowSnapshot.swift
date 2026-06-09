import CoreGraphics
import Foundation

/// A snapshot of a window's identity and saved position within a task context.
///
/// Each window assigned to a context gets a snapshot that records:
/// - Its current CGWindowID (which may become stale after restart)
/// - A fingerprint for re-matching after restart
/// - The saved frame (position and size) for restoring when the context activates
public struct SystemWindowSnapshot: Codable, Identifiable, Equatable, Sendable {
    /// A stable identifier for this snapshot within its context.
    /// This is NOT the CGWindowID — it persists across restarts.
    public let id: UUID

    /// The current CGWindowID, if the window is alive. Nil when the window
    /// has been closed or the app has been quit (dormant state).
    public var windowID: UInt32?

    /// The fingerprint used to re-match this window after restart.
    public let fingerprint: SystemWindowFingerprint

    /// The saved frame (position and size) to restore when this context activates.
    public var savedFrame: CGRect

    /// The display ID the window should be restored to.
    public var display: UInt32

    /// The owning application's name.
    public let app: String

    /// The window title at the time of the last snapshot update.
    public var title: String

    /// When this snapshot was last seen with a live window.
    public var lastSeen: Date

    /// Whether this snapshot currently has a live window.
    public var isLive: Bool {
        windowID != nil
    }

    /// Creates a new snapshot with a generated UUID.
    public init(
        id: UUID = UUID(),
        windowID: UInt32? = nil,
        fingerprint: SystemWindowFingerprint,
        savedFrame: CGRect,
        display: UInt32,
        app: String,
        title: String,
        lastSeen: Date = Date()
    ) {
        self.id = id
        self.windowID = windowID
        self.fingerprint = fingerprint
        self.savedFrame = savedFrame
        self.display = display
        self.app = app
        self.title = title
        self.lastSeen = lastSeen
    }
}

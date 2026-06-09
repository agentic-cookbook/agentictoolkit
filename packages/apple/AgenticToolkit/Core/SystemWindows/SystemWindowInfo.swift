import CoreGraphics
import Foundation

/// Information about a visible window, obtained from CGWindowListCopyWindowInfo.
public struct SystemWindowInfo: Codable, Identifiable, Equatable, Sendable {
    /// The CGWindowID for this window.
    public let id: UInt32

    /// The owning application's name (e.g., "Xcode", "Brave Browser").
    public let app: String

    /// The owning application's process ID.
    public let pid: Int32

    /// The window title (may be empty for some windows).
    public let title: String

    /// The window's frame in screen coordinates.
    public let frame: CGRect

    /// The display ID the window is primarily on.
    public let display: UInt32

    /// Whether the window is currently on-screen (not minimized or off-screen).
    public let isOnScreen: Bool

    /// The window layer (normal windows are layer 0).
    public let layer: Int32

    public init(
        id: UInt32,
        app: String,
        pid: Int32,
        title: String,
        frame: CGRect,
        display: UInt32,
        isOnScreen: Bool,
        layer: Int32
    ) {
        self.id = id
        self.app = app
        self.pid = pid
        self.title = title
        self.frame = frame
        self.display = display
        self.isOnScreen = isOnScreen
        self.layer = layer
    }

    /// Returns a copy with a different title.
    ///
    /// Used to backfill titles obtained via Accessibility when
    /// CGWindowListCopyWindowInfo omits them (no Screen Recording permission).
    public func withTitle(_ newTitle: String) -> SystemWindowInfo {
        SystemWindowInfo(
            id: id,
            app: app,
            pid: pid,
            title: newTitle,
            frame: frame,
            display: display,
            isOnScreen: isOnScreen,
            layer: layer
        )
    }
}

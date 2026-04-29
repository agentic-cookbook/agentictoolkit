import AppKit

/// Top-level coordinator for window infrastructure. Owns a
/// `WindowFrameManager` (frame persistence + screen-change handling)
/// and a `WindowRegistry` (live `SingleWindowController` lookup).
///
/// Most callers go through one of the two: e.g.
/// `WindowManager.shared.frames.restoreFrame(...)` or
/// `WindowManager.shared.registry.controller(forID:)`.
@MainActor
public final class WindowManager {

    public static let shared = WindowManager()

    /// Frame persistence + screen-change handling.
    public let frames: WindowFrameManager

    /// Live `SingleWindowController` lookup by `windowID`.
    public let registry = WindowRegistry()

    public init(
        screenProvider: ScreenProvider = RealScreenProvider(),
        storage: WindowStateStorage = UserDefaultsWindowStateStorage()
    ) {
        self.frames = WindowFrameManager(screenProvider: screenProvider, storage: storage)
    }
}

import AppKit

/// A full record of one attached screen at a moment in time: identity
/// (fingerprint), geometry (frame + visible frame in global coordinates),
/// and display properties. Persisted inside a `ScreenSet` so the app can
/// recognize a screen arrangement it has seen before — and, eventually,
/// show the user their saved arrangements.
public struct ScreenSnapshot: Codable, Equatable, Sendable {
    public let displayUUID: String?
    public let localizedName: String?
    /// Full screen frame in global (bottom-left-origin) desktop coordinates.
    public let frame: CGRect
    /// Frame minus the menu bar / Dock, in the same global coordinates.
    public let visibleFrame: CGRect
    public let backingScaleFactor: CGFloat
    public let isMain: Bool

    public init(
        displayUUID: String?,
        localizedName: String?,
        frame: CGRect,
        visibleFrame: CGRect,
        backingScaleFactor: CGFloat,
        isMain: Bool
    ) {
        self.displayUUID = displayUUID
        self.localizedName = localizedName
        self.frame = frame
        self.visibleFrame = visibleFrame
        self.backingScaleFactor = backingScaleFactor
        self.isMain = isMain
    }

    public init(_ screen: ScreenInfo) {
        let fingerprint = screen.fingerprint
        self.init(
            displayUUID: fingerprint.displayUUID,
            localizedName: fingerprint.localizedName,
            frame: screen.frame,
            visibleFrame: screen.visibleFrame,
            backingScaleFactor: screen.backingScaleFactor,
            isMain: fingerprint.isMain
        )
    }

    /// The identity component this screen contributes to a `ScreenSet` id.
    /// Prefers the display UUID (stable across resolution/arrangement
    /// changes); falls back to name + resolution for screens without one.
    public var identityComponent: String {
        if let displayUUID { return displayUUID }
        let name = localizedName ?? "unknown"
        return "\(name)|\(Int(frame.width))x\(Int(frame.height))"
    }
}

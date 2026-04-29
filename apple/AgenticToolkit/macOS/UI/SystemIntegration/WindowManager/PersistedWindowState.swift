import CoreGraphics
import Foundation

/// The saved state for a window, stored as JSON.
public struct PersistedWindowState: Codable {
    public let proportionalX: CGFloat
    public let proportionalY: CGFloat
    public let width: CGFloat
    public let height: CGFloat
    public let screenFingerprint: ScreenFingerprint
    public let savedAt: Date

    public init(
        proportionalX: CGFloat,
        proportionalY: CGFloat,
        width: CGFloat,
        height: CGFloat,
        screenFingerprint: ScreenFingerprint,
        savedAt: Date
    ) {
        self.proportionalX = proportionalX
        self.proportionalY = proportionalY
        self.width = width
        self.height = height
        self.screenFingerprint = screenFingerprint
        self.savedAt = savedAt
    }
}

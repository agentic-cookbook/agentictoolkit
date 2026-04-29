import AppKit

/// Declares the spatial rules for a managed window.
public struct WindowSpec: Codable, Sendable, Equatable {
    public let defaultSize: NSSize
    public let minSize: NSSize
    public let defaultPosition: WindowPosition
    public let persistsFrame: Bool

    public init(
        defaultSize: NSSize,
        minSize: NSSize,
        defaultPosition: WindowPosition,
        persistsFrame: Bool
    ) {
        self.defaultSize = defaultSize
        self.minSize = minSize
        self.defaultPosition = defaultPosition
        self.persistsFrame = persistsFrame
    }
}


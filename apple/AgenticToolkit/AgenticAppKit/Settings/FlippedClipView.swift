import AppKit

/// An NSClipView subclass with a flipped coordinate system so that
/// scroll view document content is pinned to the top-left.
public final class FlippedClipView: NSClipView {
    override public var isFlipped: Bool { true }
}

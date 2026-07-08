import AppKit
import AgenticToolkitCore

/// Pure functions for proportional frame math. No side effects, fully testable.
public enum FrameCalculator {

    /// Computes proportional coordinates for a window frame on a screen.
    public static func proportionalPosition(
        windowFrame: NSRect,
        screenVisibleFrame: NSRect
    ) -> (x: CGFloat, y: CGFloat) {
        let availableWidth = screenVisibleFrame.width - windowFrame.width
        let availableHeight = screenVisibleFrame.height - windowFrame.height

        let propX = availableWidth > 0
            ? ((windowFrame.origin.x - screenVisibleFrame.origin.x) / availableWidth).clamped(to: -0.1...1.1)
            : 0.5
        let propY = availableHeight > 0
            ? ((windowFrame.origin.y - screenVisibleFrame.origin.y) / availableHeight).clamped(to: -0.1...1.1)
            : 0.5

        return (propX, propY)
    }

    /// Computes an absolute frame from proportional coordinates and a screen.
    public static func absoluteFrame(
        proportionalX: CGFloat,
        proportionalY: CGFloat,
        width: CGFloat,
        height: CGFloat,
        screenVisibleFrame: NSRect,
        minSize: NSSize
    ) -> NSRect {
        let clampedWidth = Swift.min(Swift.max(width, minSize.width), screenVisibleFrame.width)
        let clampedHeight = Swift.min(Swift.max(height, minSize.height), screenVisibleFrame.height)

        let availableWidth = screenVisibleFrame.width - clampedWidth
        let availableHeight = screenVisibleFrame.height - clampedHeight

        let originX = screenVisibleFrame.origin.x + proportionalX * Swift.max(availableWidth, 0)
        let originY = screenVisibleFrame.origin.y + proportionalY * Swift.max(availableHeight, 0)

        return NSRect(x: originX, y: originY, width: clampedWidth, height: clampedHeight)
    }

    /// Computes a default frame for a spec on a screen.
    public static func defaultFrame(
        spec: WindowSpec,
        screenVisibleFrame: NSRect
    ) -> NSRect {
        absoluteFrame(
            proportionalX: spec.defaultPosition.proportionalX,
            proportionalY: spec.defaultPosition.proportionalY,
            width: spec.defaultSize.width,
            height: spec.defaultSize.height,
            screenVisibleFrame: screenVisibleFrame,
            minSize: spec.minSize
        )
    }

    // MARK: - Top-left anchored positioning (user's point of view)
    //
    // macOS frames have a bottom-left origin with y growing upward; from the
    // user's point of view the anchor that matters is the window's TOP-left
    // corner, with y growing downward from the top of the screen's visible
    // area. All "topLeft" values below use that user-POV convention.

    /// The window's top-left corner as an offset from the screen's
    /// visible-frame top-left. `x` points right, `y` points down.
    public static func topLeftOffset(
        windowFrame: NSRect,
        screenVisibleFrame visible: NSRect
    ) -> CGPoint {
        CGPoint(
            x: windowFrame.minX - visible.minX,
            y: visible.maxY - windowFrame.maxY
        )
    }

    /// Rebuilds an absolute frame from a user-POV top-left offset and size.
    public static func frame(
        topLeftOffset: CGPoint,
        size: NSSize,
        screenVisibleFrame visible: NSRect
    ) -> NSRect {
        NSRect(
            x: visible.minX + topLeftOffset.x,
            y: visible.maxY - topLeftOffset.y - size.height,
            width: size.width,
            height: size.height
        )
    }

    /// Where the window sits as a fraction of its available travel, top-left
    /// anchored: (0, 0) = flush top-left, (1, 1) = flush bottom-right,
    /// (0.5, 0.5) = centered. Clamped to 0...1; 0.5 when there is no travel
    /// (window fills the axis).
    public static func relativePosition(
        windowFrame: NSRect,
        screenVisibleFrame visible: NSRect
    ) -> CGPoint {
        let offset = topLeftOffset(windowFrame: windowFrame, screenVisibleFrame: visible)
        let travelX = visible.width - windowFrame.width
        let travelY = visible.height - windowFrame.height
        return CGPoint(
            x: travelX > 0 ? (offset.x / travelX).clamped(to: 0...1) : 0.5,
            y: travelY > 0 ? (offset.y / travelY).clamped(to: 0...1) : 0.5
        )
    }

    /// Rebuilds an absolute frame from a relative (travel-fraction) position.
    /// Used when the saved absolute offset no longer applies literally — a
    /// resolution change, or placing the window on a screen it has never
    /// been on.
    public static func frame(
        relativePosition: CGPoint,
        size: NSSize,
        screenVisibleFrame visible: NSRect,
        minSize: NSSize
    ) -> NSRect {
        let width = Swift.min(Swift.max(size.width, minSize.width), visible.width)
        let height = Swift.min(Swift.max(size.height, minSize.height), visible.height)
        let offset = CGPoint(
            x: relativePosition.x * Swift.max(visible.width - width, 0),
            y: relativePosition.y * Swift.max(visible.height - height, 0)
        )
        return frame(
            topLeftOffset: offset,
            size: NSSize(width: width, height: height),
            screenVisibleFrame: visible
        )
    }

    /// Frame for a content-hugging window that wants `desiredFrameSize`:
    /// the top-left corner stays fixed and growth extends down and to the
    /// right. When the desired size would push past the visible area's
    /// right/bottom edge, `policy` decides:
    ///
    /// - `.scrollContent`: the window stops at the edge (size is clamped to
    ///   the room available from its anchor) and the content scrolls.
    /// - `.moveToDisclose`: the window keeps the desired size (clamped to
    ///   the screen) and moves as little as possible — stopping the moment
    ///   it is fully on screen.
    public static func contentHuggingFrame(
        currentFrame: NSRect,
        desiredFrameSize: NSSize,
        screenVisibleFrame visible: NSRect,
        policy: WindowSpec.OverflowPolicy,
        minSize: NSSize
    ) -> NSRect {
        var size = NSSize(
            width: Swift.max(desiredFrameSize.width, minSize.width),
            height: Swift.max(desiredFrameSize.height, minSize.height)
        )
        switch policy {
        case .scrollContent:
            // Room from the fixed top-left anchor to the visible right/bottom
            // edges; never below minSize (a window already hanging past the
            // edge keeps its minimum rather than collapsing).
            let roomRight = visible.maxX - currentFrame.minX
            let roomDown = currentFrame.maxY - visible.minY
            size.width = Swift.min(size.width, Swift.max(roomRight, minSize.width))
            size.height = Swift.min(size.height, Swift.max(roomDown, minSize.height))
            return NSRect(
                x: currentFrame.minX,
                y: currentFrame.maxY - size.height,
                width: size.width,
                height: size.height
            )
        case .moveToDisclose:
            let grown = NSRect(
                x: currentFrame.minX,
                y: currentFrame.maxY - size.height,
                width: size.width,
                height: size.height
            )
            // validateFrame's push-into-bounds is exactly "move as little as
            // possible, stop as soon as fully on screen."
            return validateFrame(grown, screenVisibleFrame: visible, minSize: minSize)
        }
    }

    /// Ensures a frame is fully visible within a screen's visible area.
    public static func validateFrame(
        _ frame: NSRect,
        screenVisibleFrame visible: NSRect,
        minSize: NSSize
    ) -> NSRect {
        var result = frame

        // Enforce minimum size
        result.size.width = Swift.max(result.size.width, minSize.width)
        result.size.height = Swift.max(result.size.height, minSize.height)

        // Clamp size to screen
        result.size.width = Swift.min(result.size.width, visible.width)
        result.size.height = Swift.min(result.size.height, visible.height)

        // Push into visible bounds
        if result.maxX > visible.maxX {
            result.origin.x = visible.maxX - result.width
        }
        if result.origin.x < visible.origin.x {
            result.origin.x = visible.origin.x
        }
        if result.maxY > visible.maxY {
            result.origin.y = visible.maxY - result.height
        }
        if result.origin.y < visible.origin.y {
            result.origin.y = visible.origin.y
        }

        return result
    }
}

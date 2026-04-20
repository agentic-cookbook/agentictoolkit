import AppKit

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
        let w = Swift.min(Swift.max(width, minSize.width), screenVisibleFrame.width)
        let h = Swift.min(Swift.max(height, minSize.height), screenVisibleFrame.height)

        let availableWidth = screenVisibleFrame.width - w
        let availableHeight = screenVisibleFrame.height - h

        let x = screenVisibleFrame.origin.x + proportionalX * Swift.max(availableWidth, 0)
        let y = screenVisibleFrame.origin.y + proportionalY * Swift.max(availableHeight, 0)

        return NSRect(x: x, y: y, width: w, height: h)
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

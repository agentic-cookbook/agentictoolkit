import AppKit

extension NSWindow {
    /// Resizes the window so its height matches `contentHeight` (plus the title bar),
    /// anchored at the top edge, clamped between the window's `minSize.height` and the
    /// screen's visible height. A no-op when the resulting delta is under 1pt.
    ///
    /// Shared by the toolkit's session-list panel and Stenographer's Sessions window —
    /// both size their window to a list's intrinsic content height.
    public func fitHeight(toContentHeight contentHeight: CGFloat) {
        guard contentHeight > 0 else { return }
        let titleBarHeight = frame.height - contentLayoutRect.height
        let screenMax = (screen ?? NSScreen.main)?.visibleFrame.height ?? 800
        let newHeight = min(max(contentHeight + titleBarHeight, minSize.height), screenMax)
        var newFrame = frame
        guard abs(newFrame.height - newHeight) > 1 else { return }
        newFrame.origin.y -= (newHeight - newFrame.height)
        newFrame.size.height = newHeight
        setFrame(newFrame, display: true, animate: false)
    }
}

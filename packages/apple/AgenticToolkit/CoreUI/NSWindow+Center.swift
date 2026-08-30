import AppKit

public extension NSWindow {

    /// Centers the window, as a responder-chain action so a menu item can be
    /// aimed at "whatever window is frontmost" without the menu knowing which
    /// window that is.
    ///
    /// `NSWindow.center()` already exists but takes no sender, so it cannot be
    /// a menu item's action. This is the `@objc` wrapper, not a second
    /// implementation of centering.
    @objc func centerWindow(_ sender: Any?) {
        center()
    }
}

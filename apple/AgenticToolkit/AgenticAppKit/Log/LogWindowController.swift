import AppKit

/// Thin window wrapper around any content view — typically a
/// ``LogView`` composed alongside a caller-supplied toolbar.
///
/// The controller does not own the ``LogProvider``; callers wire the
/// provider into whatever view they pass in. Keeping it generic over
/// `NSView` lets consumers stack their own filter / action controls
/// above the scrolling log without this type learning about them.
@MainActor
public final class LogWindowController: NSObject, NSWindowDelegate {
    public let window: NSWindow
    private let onClose: (() -> Void)?

    public init(
        contentView: NSView,
        title: String,
        defaultSize: NSSize = NSSize(width: 900, height: 600),
        onClose: (() -> Void)? = nil
    ) {
        let styleMask: NSWindow.StyleMask = [.titled, .closable, .resizable, .miniaturizable]
        let window = NSWindow(
            contentRect: NSRect(origin: .zero, size: defaultSize),
            styleMask: styleMask,
            backing: .buffered,
            defer: false
        )
        window.title = title
        window.contentView = contentView
        window.setContentSize(defaultSize)
        window.center()
        window.isReleasedWhenClosed = false
        self.window = window
        self.onClose = onClose
        super.init()
        window.delegate = self
    }

    public func show() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    public func close() {
        window.performClose(nil)
    }

    public func windowWillClose(_ notification: Notification) {
        onClose?()
    }
}

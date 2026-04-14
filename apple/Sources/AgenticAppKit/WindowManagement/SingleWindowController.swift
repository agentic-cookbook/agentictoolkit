import AppKit

/// A reusable controller that lazily manages a single NSWindow with
/// WindowManager frame persistence.
///
/// The content view is provided via a closure, called once when the window
/// is first shown. The window is reused on subsequent `showWindow()` calls.
///
/// Usage:
/// ```swift
/// let controller = SingleWindowController(
///     windowID: "settings",
///     title: "Settings",
///     contentRect: NSRect(x: 0, y: 0, width: 600, height: 480)
/// ) {
///     MySettingsView(viewModel: vm)
/// }
/// controller.showWindow()
/// ```
@MainActor
open class SingleWindowController: NSObject, NSWindowDelegate {

    public let windowID: String

    private let windowTitle: String
    private let defaultContentRect: NSRect
    private let windowStyleMask: NSWindow.StyleMask
    private let contentViewProvider: () -> NSView

    public private(set) var window: NSWindow?

    public init(
        windowID: String,
        title: String,
        contentRect: NSRect = NSRect(x: 0, y: 0, width: 600, height: 480),
        styleMask: NSWindow.StyleMask = [.titled, .closable, .resizable],
        contentView: @escaping () -> NSView
    ) {
        self.windowID = windowID
        self.windowTitle = title
        self.defaultContentRect = contentRect
        self.windowStyleMask = styleMask
        self.contentViewProvider = contentView
    }

    /// Shows the window, creating it lazily on first call.
    open func showWindow() {
        if let window = window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let newWindow = NSWindow(
            contentRect: defaultContentRect,
            styleMask: windowStyleMask,
            backing: .buffered,
            defer: false
        )
        newWindow.title = windowTitle
        newWindow.isReleasedWhenClosed = false
        newWindow.delegate = self

        let contentView = contentViewProvider()
        contentView.translatesAutoresizingMaskIntoConstraints = false

        // NSWindow created via init(contentRect:...) always has a contentView,
        // but the property is typed optional. Install one explicitly if it
        // somehow isn't there rather than crashing.
        let container: NSView
        if let existing = newWindow.contentView {
            container = existing
        } else {
            let fresh = NSView()
            newWindow.contentView = fresh
            container = fresh
        }
        container.addSubview(contentView)
        NSLayoutConstraint.activate([
            contentView.topAnchor.constraint(equalTo: container.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        WindowManager.shared.restoreFrame(for: newWindow, id: windowID)

        self.window = newWindow
        newWindow.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    /// Hides the window without destroying it.
    open func dismiss() {
        window?.orderOut(nil)
    }

    /// Whether the window is currently visible.
    public var isVisible: Bool {
        window?.isVisible ?? false
    }

    // MARK: - NSWindowDelegate

    open func windowDidMove(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.saveFrame(for: window, id: windowID)
    }

    open func windowDidResize(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.saveFrame(for: window, id: windowID)
    }
}

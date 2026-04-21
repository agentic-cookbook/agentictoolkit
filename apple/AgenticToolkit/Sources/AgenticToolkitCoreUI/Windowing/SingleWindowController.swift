import AppKit

/// A reusable `NSWindowController` base that lazily builds a single
/// `NSWindow` from subclass-supplied configuration and persists its frame
/// through `WindowManager`. Subclasses provide title, size, style mask, and
/// content by overriding the open properties and factory methods below.
///
/// Usage:
/// ```swift
/// final class MyWindowController: SingleWindowController {
///     init() { super.init(windowID: "mine") }
///
///     override var windowTitle: String { "My Window" }
///     override var defaultContentRect: NSRect { NSRect(x: 0, y: 0, width: 800, height: 600) }
///     override func makeContentViewController() -> NSViewController? {
///         MyViewController()
///     }
/// }
/// ```
///
/// The window is created on the first access that triggers `loadWindow()`
/// (e.g. `showWindow()`, reading `window`, checking `isWindowLoaded`) and
/// reused on subsequent calls. Prefer `makeContentViewController()` — the
/// NSViewController lifecycle fires correctly. Override `makeContentView()`
/// if you only need an `NSView`.
@MainActor
open class SingleWindowController: NSWindowController, NSWindowDelegate {

    public let windowID: String

    public init(windowID: String) {
        self.windowID = windowID
        super.init(window: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported for SingleWindowController")
    }

    // MARK: - Overridable configuration

    /// Title shown in the window's title bar.
    open var windowTitle: String { "" }

    /// Initial content rect used when the window is first created. Frame
    /// persistence via `WindowManager` may override size/position on
    /// subsequent launches if a saved frame exists for `windowID`.
    open var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 600, height: 480)
    }

    /// Style mask for the window.
    open var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .resizable]
    }

    /// Optional minimum size. If non-nil it is applied to the window after
    /// creation.
    open var minSize: NSSize? { nil }

    /// Content factory — override one of these. If both return nil the
    /// controller traps on first `showWindow()`.
    ///
    /// Prefer `makeContentViewController()` — setting
    /// `window.contentViewController` is the canonical AppKit pattern and
    /// drives the NSViewController view lifecycle
    /// (`viewDidLoad` / `viewWillAppear` / `viewDidDisappear` / …).
    open func makeContentViewController() -> NSViewController? { nil }

    /// NSView variant for controllers that don't need a view controller.
    open func makeContentView() -> NSView? { nil }

    /// Called after the window has been fully constructed and its frame
    /// restored. Override for post-creation mutation (e.g. wiring extra
    /// observers). Runs *before* the window is ordered in.
    open func configureWindow(_ window: NSWindow) {}

    // MARK: - NSWindowController lazy-load hook

    open override func loadWindow() {
        let newWindow = NSWindow(
            contentRect: defaultContentRect,
            styleMask: windowStyleMask,
            backing: .buffered,
            defer: false
        )
        newWindow.title = windowTitle
        newWindow.isReleasedWhenClosed = false
        newWindow.delegate = self
        if let minSize = minSize {
            newWindow.minSize = minSize
        }

        if let viewController = makeContentViewController() {
            newWindow.contentViewController = viewController
        } else if let contentView = makeContentView() {
            installContentView(contentView, in: newWindow)
        } else {
            fatalError("\(type(of: self)) must override makeContentViewController() or makeContentView()")
        }

        self.window = newWindow
        let restored = WindowManager.shared.restoreFrame(for: newWindow, id: windowID)
        if !restored {
            newWindow.center()
        }
        configureWindow(newWindow)
    }

    // MARK: - Public API

    /// Shows the window, creating it lazily on first call. Subsequent calls
    /// bring the existing window to front. Thin no-arg wrapper over
    /// `NSWindowController.showWindow(_:)` so existing call sites keep
    /// working.
    open func showWindow() {
        showWindow(nil)
    }

    open override func showWindow(_ sender: Any?) {
        super.showWindow(sender)
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

    open func windowWillClose(_ notification: Notification) {}

    // MARK: - Helpers

    private func installContentView(_ contentView: NSView, in window: NSWindow) {
        contentView.translatesAutoresizingMaskIntoConstraints = false

        let container: NSView
        if let existing = window.contentView {
            container = existing
        } else {
            let fresh = NSView()
            window.contentView = fresh
            container = fresh
        }
        container.addSubview(contentView)
        NSLayoutConstraint.activate([
            contentView.topAnchor.constraint(equalTo: container.topAnchor),
            contentView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            contentView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            contentView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
    }
}

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

    public static let defaultSize = NSSize(width: 600, height: 480)

    public var windowID: String = ""

    /// Set by `configureAsHUD()`. Tells `loadWindow()` to apply the HUD
    /// chrome (borderless, no shadow chrome, floating, transparent backing)
    /// after the NSWindow is created.
    private var hudConfiguration: HUDConfiguration?

    /// Initializes the controller and registers it with
    /// `WindowManager.shared.registry` under `windowID`. The host's launch
    /// path then calls `WindowManager.shared.restoreOnLaunch()` once to
    /// re-show every registered window whose spec opts in to visibility
    /// persistence — no per-controller restore call is needed.
    public init(windowID: String, contentViewController: NSViewController) {
        self.windowID = windowID
        super.init(window: nil)
        self.contentViewController = contentViewController
        WindowManager.shared.registry.register(self)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported for SingleWindowController")
    }

    // MARK: - Overridable configuration

    /// Title shown in the window's title bar.
    open var windowTitle: String = ""

    /// Initial content rect used when the window is first created. Frame
    /// persistence via `WindowManager` may override size/position on
    /// subsequent launches if a saved frame exists for `windowID`.
    open var defaultContentRect: NSRect {
        guard let size = windowSpec?.defaultSize else {
            return NSRect(origin: .zero, size: Self.defaultSize)
        }
        return NSRect(origin: .zero, size: size)
    }

    /// Style mask for the window.
    open var windowStyleMask: NSWindow.StyleMask = [.titled, .closable, .resizable]

    /// Optional minimum size. If non-nil it is applied to the window after
    /// creation.
    open var minSize: NSSize?

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
        // Default accessibility id derived from the windowID. Subclasses
        // can overwrite this in `configureWindow(_:)` if a different
        // namespace is preferred.
        newWindow.accessibilityID("\(AccessibilityID.slug(windowID)).window")
        if let minSize = minSize {
            newWindow.minSize = minSize
        }

        newWindow.contentViewController = contentViewController

        self.window = newWindow
        // WindowManager.restoreFrame handles positioning in every path:
        // saved geometry → restored; no saved state but spec registered →
        // applyDefaultPosition (geometric center via FrameCalculator); no
        // spec → geometric center fallback. A post-call `window.center()`
        // here would override that with AppKit's upper-center (y ≈ 1/3
        // from top), which is what it does despite the misleading name.
        WindowManager.shared.frames.restoreFrame(for: newWindow, id: windowID)
        applyToolbarButtonMask(to: newWindow)
        if let hudConfiguration {
            applyHUDChrome(hudConfiguration, to: newWindow)
        }
        configureWindow(newWindow)
        // Wire the delegate last — setting `contentViewController` above
        // resizes the window to the view's size and posts
        // `NSWindowDidResizeNotification`. If the delegate were attached
        // before that, `windowDidResize` would call `saveFrame` with the
        // default-NSWindow pre-restore frame, clobbering any prior saved
        // state (and then `restoreFrame` would read back that just-written
        // default frame instead of the spec's geometric center).
        newWindow.delegate = self
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
        // `NSWindowController.init(window: nil)` leaves `isWindowLoaded = true`
        // despite no window existing, so the default `showWindow(_:)` skips
        // `loadWindow()`. Force it so the first call actually builds the
        // window (subclasses previously duplicated this guard at every call
        // site).
        if window == nil { loadWindow() }
        super.showWindow(sender)
        // Window-scoped front-ordering. `super.showWindow` calls
        // `makeKeyAndOrderFront`, which respects app-activation state — a
        // window shown from an LSUIElement / menubar context can stay behind
        // other apps' windows. `orderFrontRegardless` brings *this* window
        // forward without touching NSApp activation (which is app-scoped and
        // the wrong tool here, and nil in headless `swift test`).
        window?.orderFrontRegardless()
        WindowManager.shared.frames.saveVisibility(true, for: windowID)
        WindowManager.shared.windowDidInteract(self, kind: .show)
    }

    /// Hides the window without destroying it. Visibility is persisted as
    /// hidden so `restoreVisibilityIfNeeded()` won't reopen it next launch.
    open func dismiss() {
        WindowManager.shared.frames.saveVisibility(false, for: windowID)
        window?.orderOut(nil)
    }

    /// Whether the window is currently visible.
    public var isVisible: Bool {
        window?.isVisible ?? false
    }

    /// Resizes the window to hug `contentSize`, keeping the visual top-left
    /// corner fixed so growth extends down and to the right. When the
    /// desired size would push past the screen edge, the spec's
    /// `overflowPolicy` decides: stop at the edge and let the content
    /// scroll, or keep the size and move the window minimally until fully
    /// disclosed. Content-hugging windows call this instead of hand-rolled
    /// `setFrame` math; the resulting resize persists through the normal
    /// delegate hooks (harmless — the top-left anchor is unchanged unless
    /// the policy moved the window, which is a real position change).
    ///
    /// This is for **non-resizable, content-hugging** windows that own both
    /// dimensions. Resizable list windows that only auto-fit *height* (and let
    /// the user own width) use `NSWindow.fitHeight(toContentHeight:)` instead —
    /// a deliberately separate, simpler mechanism, not a duplicate.
    public func fitWindow(toContentSize contentSize: NSSize) {
        // `!isContentRefitSuppressed`: while a config popover is open the window
        // is frozen (see `suppressContentRefit()`), so both the explicit refit
        // path (`performContentRefit`) and any other caller are no-ops until the
        // popover closes and `resumeContentRefit()` applies one fit.
        guard let window, !isContentRefitSuppressed,
              contentSize.width > 0, contentSize.height > 0 else { return }
        let frameSize = window.frameRect(
            forContentRect: NSRect(origin: .zero, size: contentSize)
        ).size
        // Common case on repeated content refits (poll ticks): the fitted size
        // hasn't changed, so a top-left-anchored fit is a no-op. Bail before
        // the screen scan + geometry math rather than after.
        if frameSize == window.frame.size { return }
        let frames = WindowManager.shared.frames
        guard let screen = WindowFrameManager.bestScreen(
            for: window, among: frames.screenProvider.screens
        ) else { return }
        let spec = windowSpec
        let target = FrameCalculator.contentHuggingFrame(
            currentFrame: window.frame,
            desiredFrameSize: frameSize,
            screenVisibleFrame: screen.visibleFrame,
            policy: spec?.overflowPolicy ?? .scrollContent,
            minSize: spec?.minSize ?? window.minSize
        )
        guard target != window.frame else { return }
        window.setFrame(target, display: true, animate: false)
    }

    // MARK: - Content refit seam

    /// Supplies the window's desired content size on demand. A content-hugging
    /// controller (e.g. the Usage HUD / Details window) registers this once;
    /// `performContentRefit()` and the config popover's resume-on-close both
    /// recompute the fit from this single source. A `nil` result means "no refit
    /// yet" (content not built), not zero.
    public var contentSizeProvider: (() -> NSSize?)?

    /// True while a `WindowConfigPopover` is open on this window: the window is
    /// frozen at its current size (content min == max) so a size/text slider drag
    /// *inside* the popover can't resize the window out from under the pointer.
    public private(set) var isContentRefitSuppressed = false

    /// Content min/max captured at freeze time, restored when the freeze lifts.
    private var suppressedContentMinSize: NSSize?
    private var suppressedContentMaxSize: NSSize?

    /// Recomputes the fit from `contentSizeProvider` and applies it — the single
    /// content-refit entry point for content-hugging windows. A no-op while a
    /// config popover is open (`isContentRefitSuppressed`) or before a provider
    /// is registered.
    public func performContentRefit() {
        guard !isContentRefitSuppressed, let size = contentSizeProvider?() else { return }
        fitWindow(toContentSize: size)
    }

    /// Freezes the window at its current size while a config popover is open, so a
    /// slider drag inside the popover can't shift the window under the pointer.
    /// Pins the content min/max to the live size (which also stops the AppKit
    /// auto-size-from-content path a borderless HUD uses). Idempotent; driven by
    /// `WindowConfigPopover` on popover-open.
    public func suppressContentRefit() {
        guard !isContentRefitSuppressed, let window else { return }
        isContentRefitSuppressed = true
        suppressedContentMinSize = window.contentMinSize
        suppressedContentMaxSize = window.contentMaxSize
        let current = window.contentRect(forFrameRect: window.frame).size
        window.contentMinSize = current
        window.contentMaxSize = current
    }

    /// Lifts the freeze set by `suppressContentRefit()`: restores the content
    /// min/max and applies one refit, so any content change made while the popover
    /// was open lands now. Idempotent; driven by `WindowConfigPopover` on
    /// popover-close.
    public func resumeContentRefit() {
        guard isContentRefitSuppressed else { return }
        isContentRefitSuppressed = false
        if let window {
            window.contentMinSize = suppressedContentMinSize ?? .zero
            window.contentMaxSize = suppressedContentMaxSize
                ?? NSSize(width: CGFloat.greatestFiniteMagnitude, height: .greatestFiniteMagnitude)
        }
        suppressedContentMinSize = nil
        suppressedContentMaxSize = nil
        performContentRefit()
    }

    /// If the spec opts in to visibility persistence and the last saved
    /// state was `true`, show the window. Invoked for every registered
    /// controller by `WindowManager.shared.restoreOnLaunch()`; hosts should
    /// call that single entry point rather than this per-controller method.
    public func restoreVisibilityIfNeeded() {
        guard let spec = windowSpec, spec.persistsVisibility else { return }
        if WindowManager.shared.frames.loadVisibility(for: windowID) == true {
            showWindow()
        }
    }

    // MARK: - HUD configuration

    /// Configuration captured by `configureAsHUD(...)` and replayed in
    /// `loadWindow()` after the NSWindow exists. Keeps the API ergonomic
    /// (subclasses can call `configureAsHUD()` in init, before the window
    /// is built) while keeping the mutation site in one place.
    public struct HUDConfiguration: Sendable {
        public var floating: Bool
        public var transparency: Double

        public init(floating: Bool = true, transparency: Double = 1.0) {
            self.floating = floating
            self.transparency = transparency
        }
    }

    /// Marks the window as a HUD: borderless chrome, floating level, and a
    /// transparent backing layer that respects `transparency`. Subclasses
    /// call this from `init` (before the window is built); `loadWindow()`
    /// applies the chrome after creation. Subsequent live updates flow
    /// through `setFloating(_:)` and `setTransparency(_:)`.
    open func configureAsHUD(floating: Bool = true, transparency: Double = 1.0) {
        windowStyleMask = [.borderless]
        hudConfiguration = HUDConfiguration(floating: floating, transparency: transparency)
    }

    /// Toggles the window between `.floating` and `.normal` levels. Safe to
    /// call before the window has been built — the update will be picked
    /// up on first `loadWindow()` via the stored `hudConfiguration`.
    public func setFloating(_ floating: Bool) {
        hudConfiguration?.floating = floating
        if let window = window {
            window.level = floating ? .floating : .normal
        }
    }

    /// Sets the window's alpha (clamped 0.3...1.0 to avoid an
    /// invisible-but-clickable HUD).
    public func setTransparency(_ alpha: Double) {
        hudConfiguration?.transparency = alpha
        if let window = window {
            let clamped = CGFloat(min(max(alpha, 0.3), 1.0))
            guard window.alphaValue != clamped else { return }
            window.alphaValue = clamped
        }
    }

    // MARK: - NSWindowDelegate

    open func windowDidMove(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.frames.saveFrame(for: window, id: windowID)
    }

    open func windowDidResize(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.frames.saveFrame(for: window, id: windowID)
    }

    open func windowWillClose(_ notification: Notification) {
        // Only a close while the app is *running* means the user dismissed
        // the window — persist hidden so it stays closed next launch. During
        // termination AppKit also sends `windowWillClose:` to still-visible
        // windows; persisting false there would stop a window the user left
        // open from reopening. See `WindowManagerTerminationTests`.
        if !WindowManager.shared.isTerminating {
            WindowManager.shared.frames.saveVisibility(false, for: windowID)
        }
        WindowManager.shared.windowDidInteract(self, kind: .close)
    }

    // MARK: - Helpers

    private func applyToolbarButtonMask(to window: NSWindow) {
        guard let buttons = windowSpec?.toolbarButtons else { return }
        // `standardWindowButton` is nil when the style mask doesn't include
        // the corresponding trait — setting hidden on nil is fine and lets
        // us mask buttons regardless of which traits the window declares.
        window.standardWindowButton(.closeButton)?.isHidden = !buttons.contains(.close)
        window.standardWindowButton(.miniaturizeButton)?.isHidden = !buttons.contains(.miniaturize)
        window.standardWindowButton(.zoomButton)?.isHidden = !buttons.contains(.zoom)
    }

    private func applyHUDChrome(_ config: HUDConfiguration, to window: NSWindow) {
        window.isMovableByWindowBackground = true
        window.hasShadow = true
        window.backgroundColor = .windowBackgroundColor
        window.isOpaque = false
        window.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary]
        window.level = config.floating ? .floating : .normal
        let clamped = CGFloat(min(max(config.transparency, 0.3), 1.0))
        window.alphaValue = clamped
    }
}

// MARK: - Singleton convenience

/// A `SingleWindowController` the app keeps as a process-wide singleton in its
/// `current` slot. Conformers supply the slot and a `makeShared()` factory; the
/// default `ensureCurrent()` centralizes the construct-if-nil guard (and the
/// `WindowManager` registration that construction performs) so it isn't copy-
/// pasted into every controller. Controllers whose construction needs a runtime
/// argument (e.g. the Sessions window's plugin manager) keep a bespoke
/// constructor instead of conforming.
@MainActor
public protocol SingletonWindowController: SingleWindowController {
    static var current: Self? { get set }
    /// Builds the singleton instance. Implemented inside the concrete controller
    /// so it can call a private initializer.
    static func makeShared() -> Self
}

public extension SingletonWindowController {
    /// Constructs the singleton (whose `init` registers it with `WindowManager`)
    /// without showing it, if it doesn't exist yet. `main.swift` calls this at
    /// launch so `restoreOnLaunch()` can reopen a window that was visible last
    /// session — no per-controller boilerplate.
    static func ensureCurrent() {
        if current == nil { current = makeShared() }
    }
}

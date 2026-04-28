import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS


import AppKit
import Combine
import os

/// The floating session-list window. Absorbs the former
/// `SessionWindow` / `SessionPanelController` pair into a single
/// `SingleWindowController` subclass.
@MainActor
public final class SessionWatcherPanelWindowController: SingleWindowController {

    public private(set) var viewModel: SessionWatcherListViewModel?
    public let discoveryWindowController = WindowDiscoveryWindowController()

    private var SessionWatcherDatabaseManager: SessionWatcherDatabaseManager?
    private var sessionContentView: SessionWatcherContentView?
    private var sizeObservation: NSKeyValueObservation?

    private var pendingIsFloating: Bool = true
    private var pendingTransparency: CGFloat = 0.96
    private var didShowOnce = false

    /// UserDefaults key remembering whether the panel was visible at last
    /// app-quit, so `AppDelegate` can restore the prior state on relaunch.
    /// Absent key → first launch → default to visible.
    public static let visibilityDefaultsKey = "sessionPanel.wasVisible"

    /// Whether to show the session window at app launch. True on first
    /// launch (key absent); otherwise mirrors the last persisted state.
    public static func shouldShowOnLaunch() -> Bool {
        UserDefaults.standard.object(forKey: visibilityDefaultsKey) as? Bool ?? true
    }

    public var onSettingsButtonPressed: (() -> Void)?

    public init() {
        super.init(windowID: "sessionPanel")
    }

    // MARK: - SingleWindowController hooks

    public override var windowTitle: String { "Vibe Coding Sessions" }

    public override var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 340, height: 300)
    }

    public override var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .resizable]
    }

    public override var minSize: NSSize? {
        NSSize(width: 280, height: 120)
    }

    public override func makeContentView() -> NSView? {
        guard let viewModel else {
            logger.warning("Creating session window without database manager — call setDatabaseManager first")
            return NSView()
        }
        let view = SessionWatcherContentView(viewModel: viewModel)
        sessionContentView = view
        wireContentViewObservers(view)
        return view
    }

    public override func configureWindow(_ window: NSWindow) {
        window.hidesOnDeactivate = false
        window.level = pendingIsFloating ? .floating : .normal
        window.isMovableByWindowBackground = true
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.alphaValue = pendingTransparency
        window.isOpaque = false
        window.backgroundColor = .windowBackgroundColor
    }

    // MARK: - Configuration

    public func setDatabaseManager(_ SessionWatcherDatabaseManager: SessionWatcherDatabaseManager) {
        self.SessionWatcherDatabaseManager = SessionWatcherDatabaseManager
        let vm = SessionWatcherListViewModel(
            SessionWatcherDatabaseManager: SessionWatcherDatabaseManager,
            settingsStore: UserSettings.shared
        )
        vm.onWindowDiscoveryRequested = { [weak self] session in
            self?.showWindowDiscovery(for: session)
        }
        self.viewModel = vm
    }

    // MARK: - Test / scripting accessors

    /// Returns the window after it has been built by `showPanel()` /
    /// `togglePanel()`. Does NOT trigger lazy window construction, so
    /// `panel == nil` reliably indicates "the panel has never been shown".
    public var panel: NSWindow? {
        didShowOnce ? window : nil
    }

    // MARK: - Visibility

    public func togglePanel() {
        if isVisible { hidePanel() } else { showPanel() }
    }

    public func showPanel() {
        guard viewModel != nil else {
            logger.warning("Cannot show session window without database manager")
            return
        }
        viewModel?.loadSessions()
        didShowOnce = true
        // NSWindowController.init(window: nil) marks the controller as
        // already loaded, so showWindow() never triggers loadWindow().
        // Force it here on first show.
        if window == nil {
            loadWindow()
        }
        showWindow()
        UserDefaults.standard.set(true, forKey: Self.visibilityDefaultsKey)
        DispatchQueue.main.async { [weak self] in
            self?.handleContentSizeChange()
        }
        logger.debug("SessionWatcherSession window shown")
    }

    public func hidePanel() {
        UserDefaults.standard.set(false, forKey: Self.visibilityDefaultsKey)
        guard didShowOnce, let w = window else { return }
        WindowManager.shared.saveFrame(for: w, id: windowID)
        w.orderOut(nil)
        logger.debug("SessionWatcherSession window hidden")
    }

    // MARK: - Height auto-fit

    private func wireContentViewObservers(_ view: SessionWatcherContentView) {
        // KVO on intrinsicContentSize removed under Swift 6 strict concurrency.
        // The NotificationCenter observer below covers the same signal.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleContentSizeChange),
            name: SessionWatcherContentView.contentSizeDidChangeNotification,
            object: view
        )
    }

    @objc private func handleContentSizeChange() {
        guard let v = sessionContentView else { return }
        let h = v.intrinsicContentSize.height
        if h > 0 { updatePanelHeight(to: h) }
    }

    private func updatePanelHeight(to contentHeight: CGFloat) {
        guard let w = window else { return }
        let titleBarHeight = w.frame.height - w.contentLayoutRect.height
        let screenMax = (w.screen ?? NSScreen.main)?.visibleFrame.height ?? 800
        let newHeight = min(max(contentHeight + titleBarHeight, w.minSize.height), screenMax)
        var f = w.frame
        guard abs(f.height - newHeight) > 1 else { return }
        f.origin.y -= (newHeight - f.height)
        f.size.height = newHeight
        w.setFrame(f, display: true, animate: false)
    }

    // MARK: - NSWindowDelegate

    public func windowShouldClose(_ sender: NSWindow) -> Bool {
        // Route the close button through hidePanel so visibility state is
        // persisted and the frame is saved. Return false to suppress the
        // default NSWindow close path — Whippet is a menu-bar app and
        // closing this window must not imply quitting.
        hidePanel()
        return false
    }

    public func windowWillResize(_ sender: NSWindow, to frameSize: NSSize) -> NSSize {
        NSSize(width: frameSize.width, height: sender.frame.height)
    }

    // MARK: - Floating / Transparency

    public var isFloating: Bool {
        get {
            guard didShowOnce, let w = window else { return pendingIsFloating }
            return w.level == .floating
        }
        set {
            pendingIsFloating = newValue
            panel?.level = newValue ? .floating : .normal
        }
    }

    public var transparency: CGFloat {
        get { panel?.alphaValue ?? 1.0 }
        set {
            let clamped = min(max(newValue, 0.3), 1.0)
            pendingTransparency = clamped
            panel?.alphaValue = clamped
        }
    }

    // MARK: - Discovery

    public func showWindowDiscovery(for session: SessionWatcherSession) {
        discoveryWindowController.showDiscovery(for: session)
    }

    public func dismissWindowDiscovery() {
        discoveryWindowController.dismiss()
    }

    public var isWindowDiscoveryVisible: Bool {
        discoveryWindowController.isVisible
    }
}

extension SessionWatcherPanelWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}

extension UserSettings {
    
    /// Whether the session panel floats above all other windows.
    static var sessionWindowAlwaysOnTop = UserSetting<Bool>("sessionWindowAlwaysOnTop", default: true)
    
    /// Window transparency (0.3...1.0).
    static var sessionWindowTransparency = UserSetting<Double>("sessionWindowTransparency", default: 1.0)
}

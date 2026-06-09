import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

import AppKit
import Combine
import os

extension SessionWatcher {
    /// The floating session-list window. Absorbs the former
    /// `SessionWindow` / `SessionPanelController` pair into a single
    /// `SingleWindowController` subclass.
    @MainActor
    public final class SessionWatcherWindowController: WindowController<SessionListViewController> {

        private var sizeObservation: NSKeyValueObservation?

        private var pendingIsFloating: Bool = true
        private var pendingTransparency: CGFloat = 0.96
        private var didShowOnce = false

        // Side-effect bridges. The composable panels write directly to
        // `UserSettings`; these observers drive the runtime consequences that
        // depend on the injected `windowController`. App-global appearance
        // side-effects live in `AppearanceManager`, not here.
        private var alwaysOnTopObserver: UserSettingObserver<Bool>?
        private var transparencyObserver: UserSettingObserver<Double>?

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

        public static let windowID = "sessionPanel"

        public init(source: SessionListSource) {

            super.init(
                windowID: Self.windowID,
                contentViewController: SessionListViewController(source: source)
            )

            self.windowSpec = WindowSpec(
                defaultSize: NSSize(width: 340, height: 300),
                minSize: NSSize(width: 280, height: 120),
                defaultPosition: .topRight,
                persistsFrame: true
            )

            self.minSize = NSSize(width: 280, height: 120)
            self.windowStyleMask = [.titled, .closable, .resizable]
            self.windowTitle = "Sessions"

            wireContentViewObservers()
            wireSettingsObservers()
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

        public func setSessionSummarizer(_ summarizer: SessionSummarizing) {
            viewController?.viewModel.sessionSummarizer = summarizer
        }

//        /// Returns the window after it has been built by `showPanel()` /
//        /// `togglePanel()`. Does NOT trigger lazy window construction, so
//        /// `panel == nil` reliably indicates "the panel has never been shown".
        public var panel: NSWindow? {
            didShowOnce ? window : nil
        }

        // MARK: - Visibility

        public func togglePanel() {
            if isVisible { hidePanel() } else { showPanel() }
        }

        public func showPanel() {
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
            guard didShowOnce, let panelWindow = window else { return }
            WindowManager.shared.frames.saveFrame(for: panelWindow, id: windowID)
            panelWindow.orderOut(nil)
            logger.debug("SessionWatcherSession window hidden")
        }

        // MARK: - Height auto-fit

        private func wireContentViewObservers() {
            // KVO on intrinsicContentSize removed under Swift 6 strict concurrency.
            // The NotificationCenter observer below covers the same signal.
            NotificationCenter.default.addObserver(
                self,
                selector: #selector(handleContentSizeChange),
                name: SessionListView.contentSizeDidChangeNotification,
                object: self.viewController?.view
            )
        }

        @objc private func handleContentSizeChange() {
            guard let view = self.viewController?.view else { return }
            let height = view.intrinsicContentSize.height
            if height > 0 { updatePanelHeight(to: height) }
        }

        private func updatePanelHeight(to contentHeight: CGFloat) {
            window?.fitHeight(toContentHeight: contentHeight)
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
                guard didShowOnce, let panelWindow = window else { return pendingIsFloating }
                return panelWindow.level == .floating
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

        private func wireSettingsObservers() {
            alwaysOnTopObserver = UserSettingObserver(UserSettings.sessionWindowAlwaysOnTop) { [weak self] isFloating in
                self?.isFloating = isFloating
            }
            transparencyObserver = UserSettingObserver(UserSettings.sessionWindowTransparency) { [weak self] alpha in
                self?.transparency = alpha
            }
        }
    }
}

extension SessionWatcher.SessionWatcherWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}

extension UserSettings {

    /// Whether the session panel floats above all other windows.
    public static var sessionWindowAlwaysOnTop = UserSetting<Bool>("sessionWindowAlwaysOnTop", default: true)

    /// Window transparency (0.3...1.0).
    public static var sessionWindowTransparency = UserSetting<Double>("sessionWindowTransparency", default: 1.0)
}

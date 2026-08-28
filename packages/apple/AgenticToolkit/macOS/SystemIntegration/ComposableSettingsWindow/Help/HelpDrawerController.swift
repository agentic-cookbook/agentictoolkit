import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// The settings window's help drawer: an `NSDrawer` on the window's trailing
    /// edge whose content is a `HelpDrawerView`.
    ///
    /// A drawer slides out *beside* the window instead of taking width from it,
    /// which is the whole point — opening help must not reflow the controls it
    /// is explaining, and closing it must not leave a gap where prose used to be.
    /// AppKit animates the slide, tracks the window, and flips the drawer to the
    /// other edge when there's no room on screen; none of that is ours to write.
    ///
    /// `NSDrawer` has been deprecated since 10.13 — AppKit's suggested
    /// replacement is `NSSplitViewController`, i.e. precisely the pane-that-steals-
    /// width this is not — but it is still in the SDK and still works. This type
    /// carries the same deprecation on purpose: a deprecated declaration is a
    /// warning-free zone for the API it wraps, so AppKit's drawer vocabulary
    /// stays inside this one file and everything else sees only
    /// `SettingsHelpPresenting`.
    @available(macOS, deprecated: 10.13, message: "Wraps NSDrawer, deprecated since macOS 10.13")
    @MainActor
    public final class HelpDrawerController: NSObject, SettingsHelpPresenting {

        /// Opening width. Wide enough for a comfortable measure at the 11pt
        /// explanation size; the user can drag the drawer's outer edge from
        /// `minContentWidth` to `maxContentWidth` from there.
        public static let contentWidth: CGFloat = 300
        private static let minContentWidth: CGFloat = 220
        private static let maxContentWidth: CGFloat = 520

        private let drawer: NSDrawer
        private let helpView = HelpDrawerView()
        private let preference: UserSettingObserver<Bool>

        public var onVisibilityChange: (() -> Void)?

        /// The drawer is open because the reader asked for it to be open, and for
        /// no other reason.
        ///
        /// It used to be `hasHelp && preference`, which made the drawer slam shut
        /// on the way to a panel that had no prose and slide open again on the way
        /// out — an animation triggered by clicking the sidebar, which nobody
        /// asked for and which reads as the window flinching. A panel with nothing
        /// to say now says so *inside* the drawer, where it costs a line of text
        /// instead of a change of layout.
        public var isHelpVisible: Bool { self.preference.value }

        public init(parentWindow: NSWindow) {
            self.drawer = NSDrawer(
                contentSize: NSSize(width: Self.contentWidth, height: parentWindow.frame.height),
                preferredEdge: .maxX
            )
            self.preference = UserSettingObserver(UserSettings.settingsHelpDrawerVisible)

            super.init()

            self.drawer.parentWindow = parentWindow
            self.drawer.contentView = self.helpView
            // Height is the window's to decide; only the width is draggable.
            self.drawer.minContentSize = NSSize(width: Self.minContentWidth, height: 0)
            self.drawer.maxContentSize = NSSize(width: Self.maxContentWidth, height: 0)

            self.preference.onChange = { [weak self] _ in
                self?.applyVisibility()
            }
            self.observeParentWindow(parentWindow)
        }

        /// A drawer can only open on a window that is already on screen, and the
        /// first panel is selected while the settings window is still being made
        /// visible — so the opening call at that moment is silently dropped.
        /// Re-applying when the window arrives is what makes "remembered open"
        /// actually open on launch rather than on the second try.
        ///
        /// Registered by selector rather than by block so the observation is
        /// zeroing-weak and needs no `deinit` to undo.
        private func observeParentWindow(_ window: NSWindow) {
            let center = NotificationCenter.default
            for name in [NSWindow.didBecomeKeyNotification, NSWindow.didBecomeMainNotification] {
                center.addObserver(
                    self,
                    selector: #selector(self.parentWindowDidAppear),
                    name: name,
                    object: window
                )
            }
        }

        @objc private func parentWindowDidAppear() {
            self.applyVisibility()
        }

        // MARK: - SettingsHelpPresenting

        public func setHelp(_ help: PanelHelp?) {
            self.helpView.setHelp(help)
            self.applyVisibility()
        }

        public func toggleHelp() {
            self.preference.value.toggle()
        }

        private func applyVisibility() {
            if self.isHelpVisible {
                self.drawer.open()
            } else {
                self.drawer.close()
            }
            self.onVisibilityChange?()
        }
    }
}

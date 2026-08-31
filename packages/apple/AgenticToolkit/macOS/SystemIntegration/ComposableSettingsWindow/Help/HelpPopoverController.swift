import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// Help for a settings split that lives in a **sheet** rather than in the
    /// settings window: the same `HelpDrawerView`, shown in an `NSPopover` off
    /// the help button.
    ///
    /// A drawer is wrong here on two counts. It slides out of a window's edge,
    /// and a sheet is a window that has no free edge — it is pinned to the
    /// document it belongs to. And the drawer's open/closed state is remembered
    /// across launches, which is right for a window the user returns to and
    /// wrong for a transient dialog: nothing about a sheet should teach the
    /// settings window to open its drawer.
    ///
    /// So this presenter is deliberately amnesiac — `isHelpVisible` is just
    /// "is the popover on screen right now".
    @MainActor
    public final class HelpPopoverController: NSObject, SettingsHelpPresenting, NSPopoverDelegate {

        /// Roomy enough for two or three topics without scrolling, narrow enough
        /// to keep the prose at a readable measure.
        private static let contentSize = NSSize(width: 320, height: 340)

        private let popover = NSPopover()
        private let helpView = HelpDrawerView()

        private var hasHelp = false

        public var onVisibilityChange: (() -> Void)?

        public weak var helpAnchorView: NSView?

        public var isHelpVisible: Bool { self.popover.isShown }

        public override init() {
            super.init()

            let content = NSViewController()
            content.view = self.helpView
            self.popover.contentViewController = content
            self.popover.contentSize = Self.contentSize
            // Transient rather than semitransient: the popover is reference
            // prose, so clicking back into the settings it explains should
            // dismiss it without a second trip to the button.
            self.popover.behavior = .transient
            self.popover.delegate = self
        }

        // MARK: - SettingsHelpPresenting

        public func setHelp(_ help: PanelHelp?) {
            self.hasHelp = help != nil
            self.helpView.setHelp(help)
            // A panel with no help can't leave its predecessor's prose hanging
            // over it, but switching to a panel that *has* help shouldn't pop
            // anything open unasked either.
            if !self.hasHelp, self.popover.isShown {
                self.popover.performClose(nil)
            }
        }

        public func toggleHelp() {
            if self.popover.isShown {
                self.popover.performClose(nil)
                return
            }
            guard self.hasHelp, let anchor = self.helpAnchorView, anchor.window != nil else { return }
            self.popover.show(relativeTo: anchor.bounds, of: anchor, preferredEdge: .minY)
            self.onVisibilityChange?()
        }

        // MARK: - NSPopoverDelegate

        public func popoverDidClose(_ notification: Notification) {
            self.onVisibilityChange?()
        }
    }
}

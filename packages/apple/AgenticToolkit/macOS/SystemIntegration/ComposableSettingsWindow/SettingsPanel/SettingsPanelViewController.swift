import AppKit
import Foundation
import SwiftUI

extension ComposableSettings {

    /// Base class for every settings panel. One instance is hosted in the
    /// right-hand detail pane of a `SplitViewController`; the sidebar metadata
    /// lives on the panel itself via the open overrides below. The panel *is* the
    /// list item — no wrapper struct.
    @MainActor
    open class SettingsPanelViewController: NSViewController, ComposableSettingsPanel {

        /// This is what is user for the settings panel list
        public let descriptor: SettingsPanelDescriptor

        public let settingsView = PanelView()

        /// Reference prose for the detail pane's help drawer; `nil` means this
        /// panel offers none, and the drawer shows its empty state rather than
        /// the help button disappearing. See `ComposableSettingsPanel.helpContent`.
        ///
        /// Redeclared here (rather than left to the protocol's extension default)
        /// so subclass overrides are actually reached: a protocol extension's
        /// default is bound at the point of conformance — this class — and a
        /// subclass property that merely shadows it is invisible through the
        /// `any ComposableSettingsPanel` the split holds. `hostsOwnScroll` below
        /// is redeclared for the same reason.
        open var helpContent: PanelHelp? { nil }

        /// A plain panel holds no selection, so what it shows is simply its own
        /// help. Redeclared for the same dispatch reason as `helpContent`.
        open var effectiveHelpContent: PanelHelp? { helpContent }

        open var hostsOwnScroll: Bool { false }

        /// Nothing by default: a panel built from `GroupView`s is read off
        /// its own labels once it has been opened. Override on a panel whose
        /// content is SwiftUI, or one worth finding before its first visit.
        /// Redeclared for the same dispatch reason as `helpContent`.
        open var searchKeywords: [String] { [] }

        open override func loadView() {
            self.view = settingsView
        }

        public init(with descriptor: SettingsPanelDescriptor? = nil) {
            if let descriptor {
                self.descriptor = descriptor
            } else {
                self.descriptor = SettingsPanelDescriptor()
            }
            super.init(nibName: nil, bundle: nil)
        }

        public required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        public func addGroup(_ group: GroupView) {
            self.settingsView.addGroup(group)
        }

        /// Hosts SwiftUI `content` as this panel's view, in the one configuration
        /// that cannot resize the settings window.
        ///
        /// `NSHostingView` defaults to `.standardBounds`, which installs *required*
        /// min- and max-size constraints derived from the SwiftUI content's own
        /// sizing. The detail pane pins a panel to its edges, so those constraints
        /// are the window's: a panel whose content is a stack of cards has a finite
        /// ideal height, and selecting it collapsed the window to that height and
        /// held it there.
        ///
        /// Only `.intrinsicContentSize` survives. `PanelScrollView`'s document
        /// still reads it, so content taller than the pane scrolls instead of being
        /// clipped — but an intrinsic size is a hugging-priority preference, not a
        /// limit the window has to obey. Panel content never sizes this window;
        /// the window sizes the panel.
        public static func hostingView(for content: some View) -> NSView {
            let hosting = NSHostingView(rootView: content)
            hosting.sizingOptions = [.intrinsicContentSize]
            hosting.translatesAutoresizingMaskIntoConstraints = false
            return hosting
        }
    }
}

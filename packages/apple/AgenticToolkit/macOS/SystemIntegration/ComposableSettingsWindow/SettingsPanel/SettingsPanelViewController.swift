import AppKit
import Foundation

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

        open var hostsOwnScroll: Bool { false }

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
    }
}

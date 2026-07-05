import AppKit
import Foundation

extension ComposableSettings {

    /// Base class for every settings panel. One instance is hosted in the
    /// right-hand detail pane of a `SplitViewController`; the sidebar metadata
    /// lives on the panel itself via the open overrides below. The panel *is* the
    /// list item — no wrapper struct.
    @MainActor
    open class SettingsPanelSplitViewController: SplitViewController, ComposableSettingsPanel {

        /// This is what is user for the settings panel list
        public let descriptor: SettingsPanelDescriptor

        public init(with descriptor: SettingsPanelDescriptor? = nil) {
            if let descriptor {
                self.descriptor = descriptor
            } else {
                self.descriptor = SettingsPanelDescriptor()
            }
            super.init()
        }

        public required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        /// A modest floor so the nested detail (the sub-panel content) can't be
        /// squeezed to a sliver when the inner sidebar is dragged wide at the
        /// minimum window width. It stays below the outer detail's own floor
        /// (nested sidebar 160 + this 200 = 360 ≤ the outer's 400), so it caps the
        /// inner sidebar's drag rather than compounding the window's minimum width.
        open override var detailMinimumThickness: CGFloat { 200 }

        /// A distinct autosave per nested split (keyed on the panel title) so each
        /// topic list persists its own width independently of the others.
        open override var sidebarAutosaveName: String? {
            "ComposableSettings.Sidebar.\(descriptor.title)"
        }
    }
}

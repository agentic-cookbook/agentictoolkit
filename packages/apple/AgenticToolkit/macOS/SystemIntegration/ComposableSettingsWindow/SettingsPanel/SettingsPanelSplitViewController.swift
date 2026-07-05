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
        /// squeezed to a sliver. It stays below the outer detail's own floor, so it
        /// caps the inner content rather than compounding the window's minimum width.
        open override var detailMinimumThickness: CGFloat { 200 }

        /// Nested topic lists are content-sized and unified to one width by the
        /// parent split, so switching between sibling panels never shifts the inner
        /// divider and every title stays fully disclosed.
        open override var contentSizedSidebar: Bool { true }
    }
}

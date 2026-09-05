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

        /// Reference prose for the detail pane's help drawer; `nil` means this
        /// panel offers none. Redeclared here for the same dispatch reason as on
        /// `SettingsPanelViewController` — see the note there.
        ///
        /// The help shown is the *outer* panel's: only the window's root split is
        /// given a help presenter, so a nested split hosts its own sub-panels but
        /// never its own drawer, and one panel's worth of help sits beside the
        /// whole topic list.
        open var helpContent: PanelHelp? { nil }

        /// The selected topic's help, falling back to this panel's own for a
        /// topic that offers none — a topic list is a selection, and the reader
        /// is asking about the topic, not about the list.
        open var effectiveHelpContent: PanelHelp? { effectiveHelp ?? helpContent }

        /// Nothing by default: a nested split is searched through the panels
        /// it hosts. Redeclared for the same dispatch reason as `helpContent`.
        open var searchKeywords: [String] { [] }

        public init(with descriptor: SettingsPanelDescriptor? = nil) {
            if let descriptor {
                self.descriptor = descriptor
            } else {
                self.descriptor = SettingsPanelDescriptor()
            }
            super.init()
            // A nested topic/detail panel titles its own sidebar with its panel
            // name by default (subclasses may override, e.g. Theme → "Themes").
            self.sidebarTitle = self.descriptor.title
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

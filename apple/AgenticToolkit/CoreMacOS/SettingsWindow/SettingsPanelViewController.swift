import AppKit

/// Base class for every settings panel. One instance is hosted in the
/// right-hand detail pane of a `SettingsViewController`; the sidebar metadata
/// lives on the panel itself via the open overrides below. The panel *is* the
/// list item — no wrapper struct.
@MainActor
open class SettingsPanelViewController: NSViewController {

    /// Title shown in the sidebar row. Subclasses override.
    open var panelTitle: String { "" }

    /// Optional icon shown alongside the sidebar title.
    open var icon: NSImage? { nil }

    /// Optional section grouping. Panels sharing a non-nil section render
    /// under a common header; nil-section panels form the leading unsectioned
    /// block. When no panel declares a section, the list is flat.
    open var section: String? { nil }

    open override func loadView() {
        view = SettingsPanelView()
    }
}

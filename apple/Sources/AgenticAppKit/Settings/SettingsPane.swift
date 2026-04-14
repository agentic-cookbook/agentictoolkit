import AppKit

/// A single pane in the settings window sidebar.
///
/// Clients conform to this protocol and provide an array of panes
/// to ``SettingsWindowController`` or ``SettingsSplitView``.
@MainActor
public protocol SettingsPane: AnyObject {
    /// The title shown in the sidebar.
    var title: String { get }

    /// The SF Symbol name shown beside the title in the sidebar.
    var systemImage: String { get }

    /// Creates the detail view for this pane. Called once when the pane
    /// is first selected; the view is cached for subsequent selections.
    func makeView() -> NSView
}

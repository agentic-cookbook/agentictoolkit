import AppKit

/// A view controller that can be hosted in a `SettingsViewController` as one
/// entry in its panel list. Conformers are guaranteed to be `NSViewController`s.
///
/// Plugins and host apps both vend panels through this protocol.
@MainActor
public protocol SettingsPanelViewController: NSViewController {
    /// Describes how this panel appears in the sidebar list.
    var listItem: SettingsPanelListItem { get }
}

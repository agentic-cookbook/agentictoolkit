import AppKit

/// A topic (tab) in the settings sidebar.
///
/// Apps build an array of these and pass it to `SettingsView` / `SettingsWindowController`.
/// The `id` is opaque to the toolkit — clients use it to dispatch to the right pane.
public struct SettingsTopic: Hashable, Sendable {
    /// Stable identifier; clients match on this when building a pane.
    public let id: String

    /// Display title shown in the sidebar.
    public let title: String

    /// SF Symbol name for the sidebar icon.
    public let systemImage: String

    public init(id: String, title: String, systemImage: String) {
        self.id = id
        self.title = title
        self.systemImage = systemImage
    }
}

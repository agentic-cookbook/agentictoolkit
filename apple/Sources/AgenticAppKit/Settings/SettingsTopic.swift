import AppKit

/// A topic (tab) in the settings sidebar. Apps provide their own enum or type
/// conforming to this protocol to define which panes appear.
public protocol SettingsTopic: Hashable, CaseIterable {
    /// Display title shown in the sidebar.
    var title: String { get }

    /// SF Symbol name for the sidebar icon.
    var systemImage: String { get }
}

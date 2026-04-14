import AppKit

/// How a settings panel appears in the sidebar list.
///
/// Kept as a value type so future fields (badge, subtitle, etc.) can be added
/// without changing the `SettingsPanelViewController` protocol shape.
public struct SettingsPanelListItem: Sendable {
    public let title: String
    public let image: NSImage?

    public init(title: String, image: NSImage? = nil) {
        self.title = title
        self.image = image
    }
}

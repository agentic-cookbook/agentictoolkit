import AppKit

/// How a settings panel appears in the sidebar list.
///
/// Kept as a value type so future fields (badge, subtitle, etc.) can be added
/// without changing the `SettingsPanelViewController` protocol shape.
public struct SettingsPanelListItem: Sendable {
    public let title: String
    public let image: NSImage?
    /// Optional section header. Panels sharing a non-nil section render as a
    /// group under that header; nil-section panels form a leading anonymous
    /// section. When no panel declares a section, the list is flat.
    public let section: String?

    public init(title: String, image: NSImage? = nil, section: String? = nil) {
        self.title = title
        self.image = image
        self.section = section
    }
}

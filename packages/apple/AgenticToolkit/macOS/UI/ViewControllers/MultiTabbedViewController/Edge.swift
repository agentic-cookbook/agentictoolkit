import Foundation

/// Which side of `MultiTabbedViewController`'s container a tab bar is docked to.
/// The raw value doubles as the persistence and scripting name.
public enum Edge: String, CaseIterable, Sendable {
    case top
    case right
    case bottom
    case left

    /// What to call the edge in menus and settings. Separate from `rawValue`
    /// because that one is a persisted key — it may not change when the words
    /// on screen do.
    public var displayName: String {
        switch self {
        case .top: return "Top"
        case .right: return "Right"
        case .bottom: return "Bottom"
        case .left: return "Left"
        }
    }
}

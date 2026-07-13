import Foundation

/// Which side of `MultiTabbedViewController`'s container a tab bar is docked to.
/// The raw value doubles as the persistence and scripting name.
public enum Edge: String, CaseIterable, Sendable {
    case top
    case right
    case bottom
    case left
}

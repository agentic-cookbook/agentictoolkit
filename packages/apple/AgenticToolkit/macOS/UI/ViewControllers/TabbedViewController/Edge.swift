import Foundation

/// Which side of `TabbedViewController`'s container a tab bar is docked to.
public enum Edge: CaseIterable, Sendable {
    case top
    case right
    case bottom
    case left
}

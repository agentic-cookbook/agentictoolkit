import Foundation

/// Which side of `MultiTabbedViewController`'s container a tab bar is docked to.
public enum Edge: CaseIterable, Sendable {
    case top
    case right
    case bottom
    case left
}

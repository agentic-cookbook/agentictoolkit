import Foundation

/// A persisted "screen set": the group of displays that were attached
/// together at some location (laptop alone, home desk, office desk, …).
/// Identity is the *membership* — which displays are connected — so the
/// same set is recognized across resolution and arrangement changes.
/// Window placements are keyed by `id`, letting each window remember a
/// distinct position per location the laptop travels to.
public struct ScreenSet: Codable, Equatable, Sendable {
    /// Stable identity derived from the member screens (sorted display
    /// UUIDs, with a name+resolution fallback for UUID-less screens).
    public let id: String
    /// Latest known snapshot of every member screen, in provider order.
    public var screens: [ScreenSnapshot]
    public var firstSeen: Date
    public var lastSeen: Date

    public init(id: String, screens: [ScreenSnapshot], firstSeen: Date, lastSeen: Date) {
        self.id = id
        self.screens = screens
        self.firstSeen = firstSeen
        self.lastSeen = lastSeen
    }

    /// Derives the set identity for a group of screens. Order-independent:
    /// components are sorted before joining, so the same displays always
    /// produce the same id regardless of enumeration order.
    public static func identity(of screens: [ScreenSnapshot]) -> String {
        screens.map(\.identityComponent).sorted().joined(separator: "+")
    }
}

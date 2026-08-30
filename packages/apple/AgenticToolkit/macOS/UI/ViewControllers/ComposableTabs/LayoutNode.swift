import Foundation

/// A persisted layout tree. Storage vocabulary — it outlives any one view
/// registry — but its two payloads are typed rather than free strings so a
/// spec, a registry and a stored tree can be compared without stringly
/// guesswork. Both types are `RawRepresentable` over exactly the strings the
/// schema already holds, so no stored layout changes meaning.
public struct LayoutNode: Sendable {
    public indirect enum Kind: Sendable {
        case split(orientation: ComposableTabsAxis, first: LayoutNode, second: LayoutNode)
        case leaf(contentType: ComposableTabsViewID, paneLabel: String?)
    }

    public let id: UUID
    public let kind: Kind

    public static func leaf(
        id: UUID = UUID(),
        contentType: ComposableTabsViewID,
        paneLabel: String? = nil
    ) -> LayoutNode {
        LayoutNode(id: id, kind: .leaf(contentType: contentType, paneLabel: paneLabel))
    }

    public static func split(
        id: UUID = UUID(),
        orientation: ComposableTabsAxis,
        first: LayoutNode,
        second: LayoutNode
    ) -> LayoutNode {
        LayoutNode(id: id, kind: .split(orientation: orientation, first: first, second: second))
    }
}

public struct TabRecord {
    public let id: UUID
    /// Tabs sharing a `groupID` are one project-level tab: one member per
    /// edge, all with the same title. Defaults to `id` (a group of one).
    public let groupID: UUID
    public var edge: Edge
    public var title: String
    public var root: LayoutNode
    public var focusedNodeID: UUID?

    public init(
        id: UUID = UUID(),
        groupID: UUID? = nil,
        edge: Edge = .top,
        title: String,
        root: LayoutNode,
        focusedNodeID: UUID? = nil
    ) {
        self.id = id
        self.groupID = groupID ?? id
        self.edge = edge
        self.title = title
        self.root = root
        self.focusedNodeID = focusedNodeID
    }
}

import Foundation

public enum PaneType: String, Codable, Equatable, Sendable {
    case fileEditor
    case terminal
}

public struct PaneSlot: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public var type: PaneType
    public var isVisible: Bool

    public init(id: UUID = UUID(), type: PaneType, isVisible: Bool = true) {
        self.id = id
        self.type = type
        self.isVisible = isVisible
    }
}

public struct SessionLayoutState: Codable, Equatable, Sendable {
    public var panes: [PaneSlot]
    public var isInspectorPresented: Bool

    public init() {
        self.panes = [
            PaneSlot(type: .fileEditor),
            PaneSlot(type: .terminal)
        ]
        self.isInspectorPresented = false
    }

    public init(panes: [PaneSlot], isInspectorPresented: Bool = false) {
        self.panes = panes
        self.isInspectorPresented = isInspectorPresented
    }

    public var hasFileEditor: Bool { panes.contains { $0.type == .fileEditor } }

    public var visiblePanes: [PaneSlot] { panes.filter(\.isVisible) }

    public mutating func addPane(_ type: PaneType) {
        if type == .fileEditor && hasFileEditor { return }
        panes.append(PaneSlot(type: type))
    }

    public mutating func removePane(id: UUID) {
        guard panes.count > 1 else { return }
        panes.removeAll { $0.id == id }
    }

    public mutating func movePane(from source: IndexSet, to destination: Int) {
        panes.move(fromOffsets: source, toOffset: destination)
    }

    public static func fromLegacy(
        isFileViewerVisible: Bool = true,
        isTerminalVisible: Bool = true,
        isInspectorPresented: Bool = false
    ) -> SessionLayoutState {
        var layout = SessionLayoutState()
        if let editorIdx = layout.panes.firstIndex(where: { $0.type == .fileEditor }) {
            layout.panes[editorIdx].isVisible = isFileViewerVisible
        }
        if let termIdx = layout.panes.firstIndex(where: { $0.type == .terminal }) {
            layout.panes[termIdx].isVisible = isTerminalVisible
        }
        layout.isInspectorPresented = isInspectorPresented
        return layout
    }
}

public struct SessionRecord: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public var name: String
    public var sortOrder: Int
    public var layoutState: SessionLayoutState

    public init(id: UUID, name: String, sortOrder: Int, layoutState: SessionLayoutState) {
        self.id = id
        self.name = name
        self.sortOrder = sortOrder
        self.layoutState = layoutState
    }
}

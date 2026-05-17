import Foundation

public enum TerminalSessionPaneType: String, Codable, Equatable, Sendable {
    case fileEditor
    case terminal
}

public struct TerminalSessionPaneSlot: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public var type: TerminalSessionPaneType
    public var isVisible: Bool

    public init(id: UUID = UUID(), type: TerminalSessionPaneType, isVisible: Bool = true) {
        self.id = id
        self.type = type
        self.isVisible = isVisible
    }
}

public struct TerminalSessionLayoutState: Codable, Equatable, Sendable {
    public var panes: [TerminalSessionPaneSlot]
    public var isInspectorPresented: Bool

    public init() {
        self.panes = [
            TerminalSessionPaneSlot(type: .fileEditor),
            TerminalSessionPaneSlot(type: .terminal)
        ]
        self.isInspectorPresented = false
    }

    public init(panes: [TerminalSessionPaneSlot], isInspectorPresented: Bool = false) {
        self.panes = panes
        self.isInspectorPresented = isInspectorPresented
    }

    public var hasFileEditor: Bool { panes.contains { $0.type == .fileEditor } }

    public var visiblePanes: [TerminalSessionPaneSlot] { panes.filter(\.isVisible) }

    public mutating func addPane(_ type: TerminalSessionPaneType) {
        if type == .fileEditor && hasFileEditor { return }
        panes.append(TerminalSessionPaneSlot(type: type))
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
    ) -> TerminalSessionLayoutState {
        var layout = TerminalSessionLayoutState()
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

public struct TerminalSessionSessionRecord: Codable, Equatable, Identifiable, Sendable {
    public let id: UUID
    public var name: String
    public var sortOrder: Int
    public var layoutState: TerminalSessionLayoutState

    public init(id: UUID, name: String, sortOrder: Int, layoutState: TerminalSessionLayoutState) {
        self.id = id
        self.name = name
        self.sortOrder = sortOrder
        self.layoutState = layoutState
    }
}

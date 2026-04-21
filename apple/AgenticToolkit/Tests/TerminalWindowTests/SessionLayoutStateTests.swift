import XCTest
@testable import TerminalWindow

final class SessionLayoutStateTests: XCTestCase {

    func testDefaultInitHasFileEditorAndTerminal() {
        let layout = SessionLayoutState()
        XCTAssertEqual(layout.panes.count, 2)
        XCTAssertEqual(layout.panes[0].type, .fileEditor)
        XCTAssertEqual(layout.panes[1].type, .terminal)
        XCTAssertTrue(layout.panes.allSatisfy(\.isVisible))
        XCTAssertFalse(layout.isInspectorPresented)
    }

    func testHasFileEditorReflectsPanes() {
        var layout = SessionLayoutState(panes: [PaneSlot(type: .terminal)])
        XCTAssertFalse(layout.hasFileEditor)
        layout.addPane(.fileEditor)
        XCTAssertTrue(layout.hasFileEditor)
    }

    func testAddPaneRejectsDuplicateFileEditor() {
        var layout = SessionLayoutState()
        let initialCount = layout.panes.count
        layout.addPane(.fileEditor)
        XCTAssertEqual(layout.panes.count, initialCount)
    }

    func testRemovePaneKeepsAtLeastOne() {
        var layout = SessionLayoutState(panes: [PaneSlot(type: .terminal)])
        let onlyID = layout.panes[0].id
        layout.removePane(id: onlyID)
        XCTAssertEqual(layout.panes.count, 1)
    }

    func testFromLegacyMatchesBooleans() {
        let layout = SessionLayoutState.fromLegacy(
            isFileViewerVisible: false,
            isTerminalVisible: true,
            isInspectorPresented: true
        )
        XCTAssertFalse(layout.panes.first(where: { $0.type == .fileEditor })!.isVisible)
        XCTAssertTrue(layout.panes.first(where: { $0.type == .terminal })!.isVisible)
        XCTAssertTrue(layout.isInspectorPresented)
    }

    func testVisiblePanesFiltersHidden() {
        var layout = SessionLayoutState()
        layout.panes[1].isVisible = false
        XCTAssertEqual(layout.visiblePanes.count, 1)
        XCTAssertEqual(layout.visiblePanes.first?.type, .fileEditor)
    }

    func testCodableRoundTrip() throws {
        let layout = SessionLayoutState.fromLegacy(isFileViewerVisible: true, isTerminalVisible: false)
        let data = try JSONEncoder().encode(layout)
        let decoded = try JSONDecoder().decode(SessionLayoutState.self, from: data)
        XCTAssertEqual(layout, decoded)
    }

    func testSessionRecordCodableRoundTrip() throws {
        let record = SessionRecord(
            id: UUID(),
            name: "s1",
            sortOrder: 2,
            layoutState: SessionLayoutState()
        )
        let data = try JSONEncoder().encode(record)
        let decoded = try JSONDecoder().decode(SessionRecord.self, from: data)
        XCTAssertEqual(record, decoded)
    }
}

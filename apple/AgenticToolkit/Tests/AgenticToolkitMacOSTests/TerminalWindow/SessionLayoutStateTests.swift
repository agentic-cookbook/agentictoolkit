import XCTest
@testable import AgenticToolkitMacOS

final class TerminalSessionLayoutStateTests: XCTestCase {

    func testDefaultInitHasFileEditorAndTerminal() {
        let layout = TerminalSessionLayoutState()
        XCTAssertEqual(layout.panes.count, 2)
        XCTAssertEqual(layout.panes[0].type, .fileEditor)
        XCTAssertEqual(layout.panes[1].type, .terminal)
        XCTAssertTrue(layout.panes.allSatisfy(\.isVisible))
        XCTAssertFalse(layout.isInspectorPresented)
    }

    func testHasFileEditorReflectsPanes() {
        var layout = TerminalSessionLayoutState(panes: [TerminalSessionPaneSlot(type: .terminal)])
        XCTAssertFalse(layout.hasFileEditor)
        layout.addPane(.fileEditor)
        XCTAssertTrue(layout.hasFileEditor)
    }

    func testAddPaneRejectsDuplicateFileEditor() {
        var layout = TerminalSessionLayoutState()
        let initialCount = layout.panes.count
        layout.addPane(.fileEditor)
        XCTAssertEqual(layout.panes.count, initialCount)
    }

    func testRemovePaneKeepsAtLeastOne() {
        var layout = TerminalSessionLayoutState(panes: [TerminalSessionPaneSlot(type: .terminal)])
        let onlyID = layout.panes[0].id
        layout.removePane(id: onlyID)
        XCTAssertEqual(layout.panes.count, 1)
    }

    func testFromLegacyMatchesBooleans() {
        let layout = TerminalSessionLayoutState.fromLegacy(
            isFileViewerVisible: false,
            isTerminalVisible: true,
            isInspectorPresented: true
        )
        XCTAssertFalse(layout.panes.first(where: { $0.type == .fileEditor })!.isVisible)
        XCTAssertTrue(layout.panes.first(where: { $0.type == .terminal })!.isVisible)
        XCTAssertTrue(layout.isInspectorPresented)
    }

    func testVisiblePanesFiltersHidden() {
        var layout = TerminalSessionLayoutState()
        layout.panes[1].isVisible = false
        XCTAssertEqual(layout.visiblePanes.count, 1)
        XCTAssertEqual(layout.visiblePanes.first?.type, .fileEditor)
    }

    func testCodableRoundTrip() throws {
        let layout = TerminalSessionLayoutState.fromLegacy(isFileViewerVisible: true, isTerminalVisible: false)
        let data = try JSONEncoder().encode(layout)
        let decoded = try JSONDecoder().decode(TerminalSessionLayoutState.self, from: data)
        XCTAssertEqual(layout, decoded)
    }

    func testTerminalSessionSessionRecordCodableRoundTrip() throws {
        let record = TerminalSessionSessionRecord(
            id: UUID(),
            name: "s1",
            sortOrder: 2,
            layoutState: TerminalSessionLayoutState()
        )
        let data = try JSONEncoder().encode(record)
        let decoded = try JSONDecoder().decode(TerminalSessionSessionRecord.self, from: data)
        XCTAssertEqual(record, decoded)
    }
}

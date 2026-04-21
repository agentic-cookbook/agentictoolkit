import XCTest
import AppKit
@testable import AgenticToolkitLoggingWindow

@MainActor
final class LogViewTests: XCTestCase {

    // MARK: - Column hooks

    func testSingleClickFiresColumnOnClick() {
        var clicked: LogLine?
        let columns = [
            LogColumn(id: "time", title: "Time"),
            LogColumn(
                id: "msg",
                title: "Message",
                onClick: { line in clicked = line }
            ),
        ]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["time": .plain("t"), "msg": .plain("hi")]))

        view.simulateClick(column: "msg", row: 0)
        XCTAssertEqual(clicked?["msg"]?.text, "hi")
    }

    func testDoubleClickFiresColumnOnDoubleClick() {
        var doubled: LogLine?
        let columns = [
            LogColumn(
                id: "msg",
                title: "Message",
                onDoubleClick: { line in doubled = line }
            ),
        ]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["msg": .plain("hey")]))

        view.simulateDoubleClick(column: "msg", row: 0)
        XCTAssertEqual(doubled?["msg"]?.text, "hey")
    }

    func testClickOnColumnWithoutHookDoesNothing() {
        let columns = [LogColumn(id: "msg", title: "Message")]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["msg": .plain("x")]))
        view.simulateClick(column: "msg", row: 0)
    }

    func testSingleClickDoesNotFireDoubleClickHook() {
        var doubled = 0
        let columns = [
            LogColumn(
                id: "msg",
                title: "Message",
                onDoubleClick: { _ in doubled += 1 }
            ),
        ]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["msg": .plain("x")]))
        view.simulateClick(column: "msg", row: 0)
        XCTAssertEqual(doubled, 0)
    }

    func testHooksAreScopedToTheirColumn() {
        var aClicks = 0
        var bClicks = 0
        let columns = [
            LogColumn(id: "a", title: "A", onClick: { _ in aClicks += 1 }),
            LogColumn(id: "b", title: "B", onClick: { _ in bClicks += 1 }),
        ]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["a": .plain("1"), "b": .plain("2")]))

        view.simulateClick(column: "a", row: 0)
        XCTAssertEqual(aClicks, 1)
        XCTAssertEqual(bClicks, 0)

        view.simulateClick(column: "b", row: 0)
        XCTAssertEqual(aClicks, 1)
        XCTAssertEqual(bClicks, 1)
    }

    func testHookReceivesContextPayload() {
        var seen: Int64?
        let columns = [
            LogColumn(
                id: "msg",
                title: "Message",
                onClick: { line in seen = line.context as? Int64 }
            ),
        ]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["msg": .plain("x")], context: Int64(99)))
        view.simulateClick(column: "msg", row: 0)
        XCTAssertEqual(seen, 99)
    }

    func testOutOfRangeClickIsIgnored() {
        var clicks = 0
        let columns = [
            LogColumn(id: "msg", title: "Message", onClick: { _ in clicks += 1 }),
        ]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["msg": .plain("only")]))

        view.dispatchClick(columnIndex: 0, row: 5, kind: .single)   // row out of range
        view.dispatchClick(columnIndex: 9, row: 0, kind: .single)   // column out of range
        view.dispatchClick(columnIndex: -1, row: 0, kind: .single)  // no clicked column
        view.dispatchClick(columnIndex: 0, row: -1, kind: .single)  // no clicked row
        XCTAssertEqual(clicks, 0)
    }

    // MARK: - Rendering

    func testTableReflectsProviderLineCount() {
        let columns = [LogColumn(id: "msg", title: "Message")]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        XCTAssertEqual(view.testTable.numberOfRows, 0)
        buffer.append(contentsOf: [
            LogLine(values: ["msg": .plain("a")]),
            LogLine(values: ["msg": .plain("b")]),
            LogLine(values: ["msg": .plain("c")]),
        ])
        XCTAssertEqual(view.testTable.numberOfRows, 3)
    }

    func testColumnConfigIsAppliedAtInit() {
        let columns = [
            LogColumn(id: "a", title: "Alpha", defaultWidth: 80, minWidth: 40, maxWidth: 200),
            LogColumn(id: "b", title: "Beta", defaultWidth: 220, minWidth: 100, maxWidth: 500, alignment: .right),
        ]
        let view = LogView(provider: LogBuffer(columns: columns))
        let cols = view.testTable.tableColumns
        XCTAssertEqual(cols.map { $0.identifier.rawValue }, ["a", "b"])
        XCTAssertEqual(cols[0].title, "Alpha")
        XCTAssertEqual(cols[0].width, 80)
        XCTAssertEqual(cols[1].minWidth, 100)
        XCTAssertEqual(cols[1].maxWidth, 500)
    }

    func testCellUsesPlainValue() {
        let columns = [LogColumn(id: "msg", title: "Message")]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["msg": .plain("hello world")]))
        let cell = view.testCell(column: "msg", row: 0)
        XCTAssertEqual(cell?.stringValue, "hello world")
    }

    func testCellUsesAttributedValue() {
        let columns = [LogColumn(id: "msg", title: "Message")]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        let attr = NSAttributedString(
            string: "HI",
            attributes: [.foregroundColor: NSColor.systemRed]
        )
        buffer.append(LogLine(values: ["msg": .attributed(attr)]))
        let cell = view.testCell(column: "msg", row: 0)
        XCTAssertEqual(cell?.attributedStringValue.string, "HI")
    }

    func testCellAlignmentMatchesColumn() {
        let columns = [LogColumn(id: "n", title: "N", alignment: .right)]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["n": .plain("42")]))
        let cell = view.testCell(column: "n", row: 0)
        XCTAssertEqual(cell?.alignment, .right)
    }

    func testMissingColumnValueRendersEmpty() {
        let columns = [
            LogColumn(id: "a", title: "A"),
            LogColumn(id: "b", title: "B"),
        ]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        buffer.append(LogLine(values: ["a": .plain("set")]))
        let cell = view.testCell(column: "b", row: 0)
        XCTAssertEqual(cell?.stringValue, "")
    }

    // MARK: - Delegate wiring

    func testViewInstallsItselfAsProviderDelegate() {
        let columns = [LogColumn(id: "msg", title: "Message")]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        XCTAssertTrue(buffer.delegate === view)
    }

    func testAppendTriggersTableReload() {
        let columns = [LogColumn(id: "msg", title: "Message")]
        let buffer = LogBuffer(columns: columns)
        let view = LogView(provider: buffer)
        XCTAssertEqual(view.testTable.numberOfRows, 0)
        buffer.append(LogLine(values: ["msg": .plain("x")]))
        XCTAssertEqual(view.testTable.numberOfRows, 1)
    }

    func testReplaceTriggersTableReload() {
        let columns = [LogColumn(id: "msg", title: "Message")]
        let buffer = LogBuffer(columns: columns)
        buffer.append(LogLine(values: ["msg": .plain("a")]))
        let view = LogView(provider: buffer)
        buffer.replace(with: [
            LogLine(values: ["msg": .plain("b")]),
            LogLine(values: ["msg": .plain("c")]),
        ])
        XCTAssertEqual(view.testTable.numberOfRows, 2)
    }

    func testClearTriggersTableReload() {
        let columns = [LogColumn(id: "msg", title: "Message")]
        let buffer = LogBuffer(columns: columns)
        buffer.append(LogLine(values: ["msg": .plain("a")]))
        let view = LogView(provider: buffer)
        XCTAssertEqual(view.testTable.numberOfRows, 1)
        buffer.clear()
        XCTAssertEqual(view.testTable.numberOfRows, 0)
    }

    // MARK: - followTail

    func testFollowTailDefaultIsTrue() {
        let view = LogView(provider: LogBuffer(columns: [LogColumn(id: "m", title: "M")]))
        XCTAssertTrue(view.followTail)
    }

    func testFollowTailCanBeDisabled() {
        let view = LogView(provider: LogBuffer(columns: [LogColumn(id: "m", title: "M")]))
        view.followTail = false
        XCTAssertFalse(view.followTail)
    }
}

// MARK: - Test seams

extension LogView {
    /// The internal table view. Tests use this to read row counts and
    /// fetch cells without needing a real window hierarchy.
    @MainActor
    var testTable: NSTableView {
        guard let scroll = subviews.first(where: { $0 is NSScrollView }) as? NSScrollView,
              let table = scroll.documentView as? NSTableView else {
            fatalError("LogView internal layout changed — update testTable accessor")
        }
        return table
    }

    /// Pulls the rendered cell for `(columnID, row)` through the real
    /// `NSTableViewDelegate` path — same rendering code the table
    /// exercises on screen.
    @MainActor
    func testCell(column columnID: String, row: Int) -> NSTextField? {
        guard let tc = testTable.tableColumns.first(where: { $0.identifier.rawValue == columnID }) else {
            return nil
        }
        return self.tableView(testTable, viewFor: tc, row: row) as? NSTextField
    }

    @MainActor
    func simulateClick(column columnID: String, row: Int) {
        guard let columnIndex = testTable.tableColumns.firstIndex(where: { $0.identifier.rawValue == columnID }) else {
            XCTFail("column \(columnID) not found")
            return
        }
        dispatchClick(columnIndex: columnIndex, row: row, kind: .single)
    }

    @MainActor
    func simulateDoubleClick(column columnID: String, row: Int) {
        guard let columnIndex = testTable.tableColumns.firstIndex(where: { $0.identifier.rawValue == columnID }) else {
            XCTFail("column \(columnID) not found")
            return
        }
        dispatchClick(columnIndex: columnIndex, row: row, kind: .double)
    }
}

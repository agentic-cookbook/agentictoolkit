import XCTest
import AppKit
@testable import AgenticToolkitMacOS

@MainActor
final class LogBufferTests: XCTestCase {

    // MARK: - Fixtures

    private func makeColumns() -> [LogColumn] {
        [
            LogColumn(id: "time", title: "Time"),
            LogColumn(id: "msg", title: "Message")
        ]
    }

    private func makeLine(_ message: String, context: Any? = nil) -> LogLine {
        LogLine(values: ["time": .plain("12:00"), "msg": .plain(message)], context: context)
    }

    // MARK: - Append

    func testAppendSingleLine() {
        let buffer = LogBuffer(columns: makeColumns())
        buffer.append(makeLine("hello"))
        XCTAssertEqual(buffer.lines.count, 1)
        XCTAssertEqual(buffer.lines[0]["msg"]?.text, "hello")
    }

    func testAppendContentsOfPreservesOrder() {
        let buffer = LogBuffer(columns: makeColumns())
        buffer.append(contentsOf: [makeLine("a"), makeLine("b"), makeLine("c")])
        XCTAssertEqual(buffer.lines.map { $0["msg"]?.text }, ["a", "b", "c"])
    }

    func testAppendEmptyIsNoOp() {
        let buffer = LogBuffer(columns: makeColumns())
        let delegate = RecordingDelegate()
        buffer.delegate = delegate
        buffer.append(contentsOf: [])
        XCTAssertTrue(buffer.lines.isEmpty)
        XCTAssertTrue(delegate.events.isEmpty, "empty append must not fire a delegate event")
    }

    // MARK: - Cap / FIFO

    func testCapDropsOldestOnOverflow() {
        let buffer = LogBuffer(columns: makeColumns(), maxLines: 3)
        for i in 1...5 {
            buffer.append(makeLine("m\(i)"))
        }
        XCTAssertEqual(buffer.lines.count, 3)
        XCTAssertEqual(buffer.lines.map { $0["msg"]?.text }, ["m3", "m4", "m5"])
    }

    func testCapAppliesToBatchThatExceedsLimit() {
        let buffer = LogBuffer(columns: makeColumns(), maxLines: 2)
        buffer.append(contentsOf: (1...5).map { makeLine("m\($0)") })
        XCTAssertEqual(buffer.lines.map { $0["msg"]?.text }, ["m4", "m5"])
    }

    // MARK: - Replace / Clear

    func testReplaceSwapsWholeBuffer() {
        let buffer = LogBuffer(columns: makeColumns())
        buffer.append(contentsOf: [makeLine("old1"), makeLine("old2")])
        buffer.replace(with: [makeLine("new1")])
        XCTAssertEqual(buffer.lines.map { $0["msg"]?.text }, ["new1"])
    }

    func testReplaceRespectsCap() {
        let buffer = LogBuffer(columns: makeColumns(), maxLines: 2)
        buffer.replace(with: (1...5).map { makeLine("m\($0)") })
        XCTAssertEqual(buffer.lines.map { $0["msg"]?.text }, ["m4", "m5"])
    }

    func testClearEmptiesBuffer() {
        let buffer = LogBuffer(columns: makeColumns())
        buffer.append(makeLine("x"))
        buffer.clear()
        XCTAssertTrue(buffer.lines.isEmpty)
    }

    func testClearOnEmptyIsNoOp() {
        let buffer = LogBuffer(columns: makeColumns())
        let delegate = RecordingDelegate()
        buffer.delegate = delegate
        buffer.clear()
        XCTAssertTrue(delegate.events.isEmpty, "clearing an empty buffer must not notify the delegate")
    }

    // MARK: - Delegate

    func testDelegateReceivesAppended() {
        let buffer = LogBuffer(columns: makeColumns())
        let delegate = RecordingDelegate()
        buffer.delegate = delegate
        buffer.append(contentsOf: [makeLine("a"), makeLine("b")])
        XCTAssertEqual(delegate.events, [.appended(count: 2)])
    }

    func testDelegateReceivesReplaced() {
        let buffer = LogBuffer(columns: makeColumns())
        let delegate = RecordingDelegate()
        buffer.delegate = delegate
        buffer.replace(with: [makeLine("a")])
        XCTAssertEqual(delegate.events, [.replaced])
    }

    func testDelegateReceivesCleared() {
        let buffer = LogBuffer(columns: makeColumns())
        buffer.append(makeLine("x"))
        let delegate = RecordingDelegate()
        buffer.delegate = delegate
        buffer.clear()
        XCTAssertEqual(delegate.events, [.cleared])
    }

    // MARK: - Context

    func testContextRoundTripsUnchanged() {
        let buffer = LogBuffer(columns: makeColumns())
        buffer.append(makeLine("x", context: Int64(42)))
        let ctx = buffer.lines[0].context as? Int64
        XCTAssertEqual(ctx, 42)
    }
}

// MARK: - Helpers

@MainActor
private final class RecordingDelegate: LogProviderDelegate {
    var events: [LogChange] = []

    func logProvider(_ provider: any LogProvider, didChange change: LogChange) {
        events.append(change)
    }
}

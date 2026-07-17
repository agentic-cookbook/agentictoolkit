import XCTest
@testable import AgenticToolkitSync

final class TriggerSourceTests: XCTestCase {

    func testPeriodicTicks() async throws {
        let source = PeriodicTriggerSource(interval: 0.02)
        var iterator = source.kicks.makeAsyncIterator()
        let first = await iterator.next()
        let second = await iterator.next()
        XCTAssertEqual(first, .periodic)
        XCTAssertEqual(second, .periodic)
        source.stop()
    }

    func testManualFires() async throws {
        let source = ManualTriggerSource()
        var iterator = source.kicks.makeAsyncIterator()
        source.fire(.manual)
        let got = await iterator.next()
        XCTAssertEqual(got, .manual)
    }
}

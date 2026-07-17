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

    /// If `stop()` didn't finish the continuation, the trailing `next()`
    /// below would hang forever and the test would time out — that's the
    /// failure mode this guards against, not an explicit assertion.
    func testPeriodicStopFinishesContinuation() async throws {
        let source = PeriodicTriggerSource(interval: 0.02)
        var iterator = source.kicks.makeAsyncIterator()
        _ = await iterator.next() // confirm it's actually ticking first
        source.stop()
        while await iterator.next() != nil {} // drains any already-buffered tick, then ends
    }

    /// deinit calls stop() (the task captures no self, so this is safe) —
    /// releasing the only strong reference must tear the stream down the
    /// same way an explicit stop() would.
    func testPeriodicDeinitStopsTicking() async throws {
        final class Box { var source: PeriodicTriggerSource? }
        let box = Box()
        box.source = PeriodicTriggerSource(interval: 0.02)
        var iterator = box.source!.kicks.makeAsyncIterator()
        _ = await iterator.next() // confirm it's actually ticking first
        box.source = nil // drops the only strong reference -> deinit -> stop()
        while await iterator.next() != nil {}
    }

    /// Mirrors the periodic test above for ConnectivityTriggerSource's
    /// explicit stop() (item d): it must also finish its continuation.
    func testConnectivityStopFinishesContinuation() async throws {
        let source = ConnectivityTriggerSource()
        source.stop()
        var iterator = source.kicks.makeAsyncIterator()
        while await iterator.next() != nil {}
    }
}

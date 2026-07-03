import XCTest
@testable import AgenticToolkitExecution

/// A fake resource: no SQLite, no real I/O. Its `work` loop polls both abort
/// channels so tests can exercise self-eject (hook) and watchdog (`interrupt`)
/// independently, plus fast work and cooperative concurrency.
private final class MockResource: BoundedExecutionResource, @unchecked Sendable {
    struct Aborted: Error {}

    private let lock = NSLock()
    private var hook: (@Sendable () -> Bool)?
    private var interrupted = false

    func installAbortHook(_ shouldAbort: @escaping @Sendable () -> Bool) {
        lock.withLock { hook = shouldAbort }
    }
    func interrupt() { lock.withLock { interrupted = true } }

    private func isInterrupted() -> Bool { lock.withLock { interrupted } }
    private func hookAborts() -> Bool { (lock.withLock { hook })?() ?? false }

    /// Runs up to `steps` steps of `stepDuration`, throwing `Aborted` as soon as
    /// either channel fires. `pollHook: false` simulates syscall-blocked work that
    /// only `interrupt()` can stop.
    func work(steps: Int, stepDuration: TimeInterval, pollHook: Bool = true) throws {
        lock.withLock { interrupted = false }   // fresh unit; watchdog only fires past deadline
        for _ in 0..<steps {
            if isInterrupted() { throw Aborted() }
            if pollHook && hookAborts() { throw Aborted() }
            Thread.sleep(forTimeInterval: stepDuration)
        }
    }
}

/// Tracks peak concurrent occupancy to prove the bulkhead.
private final class PeakCounter: @unchecked Sendable {
    private let lock = NSLock()
    private var current = 0
    private(set) var peak = 0
    func enter() { lock.withLock { current += 1; peak = max(peak, current) } }
    func leave() { lock.withLock { current -= 1 } }
}

final class BoundedExecutionQueueTests: XCTestCase {

    private let write = PoolID("write")
    private let read = PoolID("read")

    private func makeQueue(readers: Int = 2) -> BoundedExecutionQueue<MockResource> {
        BoundedExecutionQueue(pools: [
            write: [MockResource()],
            read: (0..<readers).map { _ in MockResource() }
        ])
    }

    // MARK: - Happy path

    func testFastWorkReturnsValue() throws {
        let queue = makeQueue(); defer { queue.shutdown() }
        let result = try queue.runSync(pool: write, deadline: .seconds(1)) { _ in 42 }
        XCTAssertEqual(result, 42)
    }

    func testBodyErrorPropagatesUnchanged() throws {
        struct Boom: Error {}
        let queue = makeQueue(); defer { queue.shutdown() }
        XCTAssertThrowsError(try queue.runSync(pool: write, deadline: .seconds(1)) { _ in
            throw Boom()
        }) { XCTAssertTrue($0 is Boom, "a within-budget error is not rewritten as an eviction") }
    }

    func testPoolNotFoundThrows() throws {
        let queue = makeQueue(); defer { queue.shutdown() }
        XCTAssertThrowsError(try queue.runSync(pool: PoolID("nope"), deadline: .seconds(1)) { _ in 0 }) {
            guard case ExecutionError.poolNotFound("nope") = $0 else { return XCTFail("wrong error: \($0)") }
        }
    }

    // MARK: - Ejection

    func testCpuBoundWorkEjectedViaSelfPollHook() throws {
        let queue = makeQueue(); defer { queue.shutdown() }
        XCTAssertThrowsError(try queue.runSync(pool: write, deadline: .milliseconds(100)) { res in
            try res.work(steps: 200, stepDuration: 0.02, pollHook: true)   // would take ~4s
        }) { error in
            guard case ExecutionError.deadlineExceeded(let pool, _) = error else {
                return XCTFail("expected deadlineExceeded, got \(error)")
            }
            XCTAssertEqual(pool, "write")
        }
    }

    func testSyscallBlockedWorkEjectedViaWatchdogInterrupt() throws {
        // pollHook:false ⇒ the hook is never consulted; only the watchdog's
        // interrupt() can stop it. Proves the second, independent channel.
        let queue = makeQueue(); defer { queue.shutdown() }
        XCTAssertThrowsError(try queue.runSync(pool: write, deadline: .milliseconds(100)) { res in
            try res.work(steps: 200, stepDuration: 0.02, pollHook: false)
        }) { error in
            guard case ExecutionError.deadlineExceeded = error else {
                return XCTFail("expected deadlineExceeded, got \(error)")
            }
        }
    }

    // MARK: - Bulkhead

    func testReadPoolRunsConcurrently() {
        let queue = makeQueue(readers: 3); defer { queue.shutdown() }
        let peak = PeakCounter()
        let pool = read   // local so the @Sendable closure doesn't capture self
        DispatchQueue.concurrentPerform(iterations: 3) { _ in
            try? queue.runSync(pool: pool, deadline: .seconds(5)) { _ in
                peak.enter(); Thread.sleep(forTimeInterval: 0.2); peak.leave()
            }
        }
        XCTAssertEqual(peak.peak, 3, "a 3-resource read pool runs 3 units at once")
    }

    func testWritePoolSerializes() {
        let queue = makeQueue(); defer { queue.shutdown() }
        let peak = PeakCounter()
        let pool = write   // local so the @Sendable closure doesn't capture self
        DispatchQueue.concurrentPerform(iterations: 4) { _ in
            try? queue.runSync(pool: pool, deadline: .seconds(5)) { _ in
                peak.enter(); Thread.sleep(forTimeInterval: 0.05); peak.leave()
            }
        }
        XCTAssertEqual(peak.peak, 1, "a single-resource write pool never overlaps")
    }

    // MARK: - Chunking

    func testRunChunkedStopsAtDone() throws {
        let queue = makeQueue(); defer { queue.shutdown() }
        let remaining = Counter(2)   // two .more, then .done on the third call
        let chunks = try queue.runChunked(
            pool: write, chunkDeadline: .seconds(1), tickBudget: .seconds(10), maxChunks: 100
        ) { _ in remaining.decrement() > 0 ? .more : .done }
        XCTAssertEqual(chunks, 3, "two .more then .done = 3 chunks run")
    }

    func testRunChunkedStopsAtMaxChunks() throws {
        let queue = makeQueue(); defer { queue.shutdown() }
        let chunks = try queue.runChunked(
            pool: write, chunkDeadline: .seconds(1), tickBudget: .seconds(10), maxChunks: 5
        ) { _ in .more }   // never done
        XCTAssertEqual(chunks, 5, "bounded by maxChunks even when always .more")
    }

    func testRunChunkedStopsAtTickBudget() throws {
        let queue = makeQueue(); defer { queue.shutdown() }
        let start = Date()
        let chunks = try queue.runChunked(
            pool: write, chunkDeadline: .seconds(1), tickBudget: .milliseconds(150), maxChunks: 1000
        ) { _ in Thread.sleep(forTimeInterval: 0.05); return .more }
        XCTAssertLessThan(chunks, 1000, "stopped by tickBudget, not maxChunks")
        XCTAssertLessThan(Date().timeIntervalSince(start), 1.0, "tick budget bounded the pass")
    }

    // MARK: - Stats

    func testStatsCountCompletedAndEvicted() throws {
        let queue = makeQueue(); defer { queue.shutdown() }
        for _ in 0..<3 { _ = try queue.runSync(pool: write, deadline: .seconds(1)) { _ in 0 } }
        _ = try? queue.runSync(pool: write, deadline: .milliseconds(80)) { res in
            try res.work(steps: 100, stepDuration: 0.02)
        }
        let writeStats = queue.stats.pools.first { $0.pool == "write" }
        XCTAssertEqual(writeStats?.completed, 3)
        XCTAssertEqual(writeStats?.evicted, 1)
        XCTAssertEqual(writeStats?.inFlight, 0)
    }
}

/// Simple thread-safe countdown for the chunking tests.
private final class Counter: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Int
    init(_ start: Int) { value = start }
    /// Returns the pre-decrement value.
    func decrement() -> Int { lock.withLock { defer { value -= 1 }; return value } }
}

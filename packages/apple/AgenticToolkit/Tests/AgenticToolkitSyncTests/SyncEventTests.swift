import XCTest
@testable import AgenticToolkitSync

final class SyncEventTests: XCTestCase {

    /// `SyncEvent.reachedBackend` is the classification hosts use to decide
    /// when to close an offline circuit. It is a reachability signal, not a
    /// sync-health one: `.pulledBatch`/`.idle` mean "we completed a live
    /// round trip this cycle," and `.authRequired` counts too — the backend
    /// answered (with a rejection), which still proves it was reached. Only
    /// `.failed` (never reached, or the backend errored) and the
    /// non-terminal/no-network-signal cases stay `false`. One assertion per
    /// case, exhaustive on purpose: a new `SyncEvent` case should force a
    /// decision here too.
    func testReachedBackendClassification() {
        XCTAssertTrue(SyncEvent.idle.reachedBackend)
        XCTAssertTrue(
            SyncEvent.pulledBatch(changes: 0, cursor: SyncCursor(rawValue: "c1")).reachedBackend
        )
        XCTAssertTrue(SyncEvent.authRequired.reachedBackend)
        XCTAssertFalse(SyncEvent.started(.periodic).reachedBackend)
        XCTAssertFalse(SyncEvent.pushed(applied: 1, conflicts: 0, rejected: 0).reachedBackend)
        XCTAssertFalse(SyncEvent.conflictResolved(resource: "widgets", rowId: "1").reachedBackend)
        XCTAssertFalse(SyncEvent.resyncPerformed.reachedBackend)
        XCTAssertFalse(SyncEvent.failed("boom").reachedBackend)
    }
}

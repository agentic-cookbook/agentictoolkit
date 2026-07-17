import XCTest
@testable import AgenticToolkitSync

final class SyncWireTests: XCTestCase {

    /// A missing fixture is a broken test environment, not a reason to skip
    /// silently (sync fix-wave item p2b): XCTSkip would report these tests
    /// as passing in CI even though nothing was actually verified. Fail
    /// loudly instead so the missing vendor step gets noticed.
    private func fixture(_ name: String) throws -> Data {
        let bundle = Bundle(for: Self.self)
        guard let url = bundle.url(forResource: name, withExtension: "json") else {
            XCTFail("missing fixture \(name).json — vendor it from the backend repo first")
            throw SyncWireTestsFixtureError.missing(name)
        }
        return try Data(contentsOf: url)
    }

    func testDecodesPullResponseFixture() throws {
        let response = try JSONDecoder().decode(SyncPullResponse.self, from: fixture("pull-response"))
        XCTAssertEqual(response.manifest.count, 7)
        XCTAssertEqual(response.changes.count, 2)
        XCTAssertEqual(response.changes[0].op, .upsert)
        XCTAssertEqual(response.changes[1].op, .delete)
        XCTAssertNil(response.changes[1].data)
        XCTAssertEqual(response.changes[0].data?["title"]?.stringValue, "Groceries")
        XCTAssertFalse(response.hasMore)
    }

    func testPushRequestRoundTripsThroughItsOwnCoding() throws {
        let request = try JSONDecoder().decode(SyncPushRequest.self, from: fixture("push-request"))
        XCTAssertEqual(request.ops.count, 3)
        let roundTripped = try JSONDecoder().decode(SyncPushRequest.self, from: JSONEncoder().encode(request))
        XCTAssertEqual(roundTripped, request)
    }

    func testDecodesPushResponseFixtureIncludingConflictRow() throws {
        let response = try JSONDecoder().decode(SyncPushResponse.self, from: fixture("push-response"))
        XCTAssertEqual(response.results.map(\.status), [.applied, .conflict, .applied])
        XCTAssertNotNil(response.results[1].current)
        XCTAssertEqual(response.watermark, "1058")
        // newVersion is populated on the two `applied` results that actually wrote a
        // row, and absent (nil) on the `conflict` — decode asserts the wire shape both
        // ways (adh sync.md §3).
        XCTAssertEqual(response.results[0].newVersion, "1056")
        XCTAssertNil(response.results[1].newVersion)
        XCTAssertEqual(response.results[2].newVersion, "1058")
    }

    func testUUIDv7IsSortableAndWellFormed() throws {
        let first = SyncID.uuidV7()
        let second = SyncID.uuidV7(now: Date().addingTimeInterval(1))
        XCTAssertNotEqual(first, second)
        XCTAssertLessThan(first, second) // time-ordered prefix ⇒ lexically sortable
        XCTAssertEqual(first.count, 36)
        XCTAssertEqual(first[first.index(first.startIndex, offsetBy: 14)], "7") // version nibble
    }
}

/// Thrown after `XCTFail` so `fixture(_:)` still returns Never on the
/// missing-file path without force-unwrapping.
private enum SyncWireTestsFixtureError: Error {
    case missing(String)
}

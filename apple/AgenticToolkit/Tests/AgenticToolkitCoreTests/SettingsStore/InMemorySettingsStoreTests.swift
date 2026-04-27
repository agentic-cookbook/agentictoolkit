import XCTest
import Combine
@testable import AgenticToolkitCore

@MainActor
final class InMemorySettingsStoreTests: XCTestCase {
    var store: InMemorySettingsStorageProvider!
    var cancellables: Set<AnyCancellable>!

    override func setUp() async throws {
        try await super.setUp()
        store = InMemorySettingsStorageProvider()
        cancellables = []
    }

    override func tearDown() async throws {
        store = nil
        cancellables = nil
        try await super.tearDown()
    }

    // MARK: - Defaults

    func testReturnsDefaultValueWhenEmpty() {
        XCTAssertEqual(store.get(.hasCompletedOnboarding), false)
        XCTAssertEqual(store.get(.launchCount), 0)
        XCTAssertEqual(store.get(.displayName), "Anonymous")
        XCTAssertEqual(store.get(.recentSearches), [])
    }

    // MARK: - Primitives

    func testStoresAndRetrievesBool() {
        store.set(true, for: .hasCompletedOnboarding)
        XCTAssertEqual(store.get(.hasCompletedOnboarding), true)
    }

    func testStoresAndRetrievesInt() {
        store.set(42, for: .launchCount)
        XCTAssertEqual(store.get(.launchCount), 42)
    }

    func testStoresAndRetrievesString() {
        store.set("Brian", for: .displayName)
        XCTAssertEqual(store.get(.displayName), "Brian")
    }

    func testStoresAndRetrievesDouble() {
        store.set(0.75, for: .volume)
        XCTAssertEqual(store.get(.volume), 0.75)
    }

    // MARK: - Collections

    func testStoresAndRetrievesStringArray() {
        let searches = ["swift", "protocols", "generics"]
        store.set(searches, for: .recentSearches)
        XCTAssertEqual(store.get(.recentSearches), searches)
    }

    func testStoresAndRetrievesIntArray() {
        store.set([1, 2, 3, 5, 8], for: .favoriteNumbers)
        XCTAssertEqual(store.get(.favoriteNumbers), [1, 2, 3, 5, 8])
    }

    // MARK: - Codable structs

    func testStoresAndRetrievesCodableStruct() {
        let prefs = UserPreferences(
            displayName: "Brian",
            theme: .dark,
            notificationsEnabled: false
        )
        store.set(prefs, for: .userPreferences)
        XCTAssertEqual(store.get(.userPreferences), prefs)
    }

    func testRoundTripsCodableStructWithMutation() {
        var prefs = store.get(.userPreferences)
        XCTAssertEqual(prefs.theme, .system)

        prefs.theme = .dark
        prefs.displayName = "Updated"
        store.set(prefs, for: .userPreferences)

        let retrieved = store.get(.userPreferences)
        XCTAssertEqual(retrieved.theme, .dark)
        XCTAssertEqual(retrieved.displayName, "Updated")
    }

    // MARK: - contains / remove

    func testContainsReturnsFalseForUnsetKey() {
        XCTAssertFalse(store.contains(.launchCount))
    }

    func testContainsReturnsTrueAfterSet() {
        store.set(1, for: .launchCount)
        XCTAssertTrue(store.contains(.launchCount))
    }

    func testRemoveClearsValueAndReturnsDefault() {
        store.set(99, for: .launchCount)
        XCTAssertTrue(store.contains(.launchCount))

        store.remove(.launchCount)
        XCTAssertFalse(store.contains(.launchCount))
        XCTAssertEqual(store.get(.launchCount), 0) // back to default
    }

    // MARK: - Initial values

    func testInitialValuesArePreserved() {
        let seeded = InMemorySettingsStorageProvider(initial: [
            "test.launchCount": 7
        ])
        XCTAssertEqual(seeded.get(.launchCount), 7)
    }

    // MARK: - Change publisher

    func testSetEmitsChange() {
        let expectation = expectation(description: "change emitted")
        var receivedKeys: [String] = []

        store.changes
            .sink { key in
                receivedKeys.append(key)
                if receivedKeys.count == 2 { expectation.fulfill() }
            }
            .store(in: &cancellables)

        store.set(1, for: .launchCount)
        store.set("hi", for: .displayName)

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(receivedKeys, ["test.launchCount", "test.displayName"])
    }

    func testRemoveEmitsChange() {
        store.set(1, for: .launchCount)

        let expectation = expectation(description: "remove emits")
        store.changes
            .sink { key in
                XCTAssertEqual(key, "test.launchCount")
                expectation.fulfill()
            }
            .store(in: &cancellables)

        store.remove(.launchCount)
        wait(for: [expectation], timeout: 1.0)
    }

    func testPublisherForKeyEmitsCurrentAndSubsequentValues() {
        store.set(5, for: .launchCount)

        let expectation = expectation(description: "publisher emits")
        var received: [Int] = []

        store.publisher(for: .launchCount)
            .sink { value in
                received.append(value)
                if received.count == 3 { expectation.fulfill() }
            }
            .store(in: &cancellables)

        store.set(6, for: .launchCount)
        store.set(7, for: .launchCount)

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(received, [5, 6, 7])
    }

    func testPublisherIgnoresOtherKeys() {
        let expectation = expectation(description: "only target key")
        var received: [Int] = []

        store.publisher(for: .launchCount)
            .sink { value in
                received.append(value)
                if received.count == 2 { expectation.fulfill() }
            }
            .store(in: &cancellables)

        store.set("ignored", for: .displayName) // should NOT trigger
        store.set(99, for: .launchCount)         // should trigger

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(received, [0, 99]) // initial default + new value
    }

    // MARK: - AsyncStream

    func testAsyncStreamYieldsValues() async {
        store.set(10, for: .launchCount)

        let stream = store.values(for: .launchCount)
        var iterator = stream.makeAsyncIterator()

        let initial = await iterator.next()
        XCTAssertEqual(initial, 10)

        // Schedule the update after the iterator is awaiting.
        Task {
            try? await Task.sleep(nanoseconds: 50_000_000) // 50ms
            self.store.set(11, for: .launchCount)
        }

        let next = await iterator.next()
        XCTAssertEqual(next, 11)
    }
}

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
        XCTAssertEqual(store.get(UserSettings.hasCompletedOnboarding), false)
        XCTAssertEqual(store.get(UserSettings.launchCount), 0)
        XCTAssertEqual(store.get(UserSettings.displayName), "Anonymous")
        XCTAssertEqual(store.get(UserSettings.recentSearches), [])
    }

    // MARK: - Primitives

    func testStoresAndRetrievesBool() {
        store.set(true, for: UserSettings.hasCompletedOnboarding)
        XCTAssertEqual(store.get(UserSettings.hasCompletedOnboarding), true)
    }

    func testStoresAndRetrievesInt() {
        store.set(42, for: UserSettings.launchCount)
        XCTAssertEqual(store.get(UserSettings.launchCount), 42)
    }

    func testStoresAndRetrievesString() {
        store.set("Brian", for: UserSettings.displayName)
        XCTAssertEqual(store.get(UserSettings.displayName), "Brian")
    }

    func testStoresAndRetrievesDouble() {
        store.set(0.75, for: UserSettings.volume)
        XCTAssertEqual(store.get(UserSettings.volume), 0.75)
    }

    // MARK: - Collections

    func testStoresAndRetrievesStringArray() {
        let searches = ["swift", "protocols", "generics"]
        store.set(searches, for: UserSettings.recentSearches)
        XCTAssertEqual(store.get(UserSettings.recentSearches), searches)
    }

    func testStoresAndRetrievesIntArray() {
        store.set([1, 2, 3, 5, 8], for: UserSettings.favoriteNumbers)
        XCTAssertEqual(store.get(UserSettings.favoriteNumbers), [1, 2, 3, 5, 8])
    }

    // MARK: - Codable structs

    func testStoresAndRetrievesCodableStruct() {
        let prefs = UserPreferences(
            displayName: "Brian",
            theme: .dark,
            notificationsEnabled: false
        )
        store.set(prefs, for: UserSettings.userPreferences)
        XCTAssertEqual(store.get(UserSettings.userPreferences), prefs)
    }

    func testRoundTripsCodableStructWithMutation() {
        var prefs = store.get(UserSettings.userPreferences)
        XCTAssertEqual(prefs.theme, .system)

        prefs.theme = .dark
        prefs.displayName = "Updated"
        store.set(prefs, for: UserSettings.userPreferences)

        let retrieved = store.get(UserSettings.userPreferences)
        XCTAssertEqual(retrieved.theme, .dark)
        XCTAssertEqual(retrieved.displayName, "Updated")
    }

    // MARK: - contains / remove

    func testContainsReturnsFalseForUnsetKey() {
        XCTAssertFalse(store.contains(UserSettings.launchCount))
    }

    func testContainsReturnsTrueAfterSet() {
        store.set(1, for: UserSettings.launchCount)
        XCTAssertTrue(store.contains(UserSettings.launchCount))
    }

    func testRemoveClearsValueAndReturnsDefault() {
        store.set(99, for: UserSettings.launchCount)
        XCTAssertTrue(store.contains(UserSettings.launchCount))

        store.remove(UserSettings.launchCount)
        XCTAssertFalse(store.contains(UserSettings.launchCount))
        XCTAssertEqual(store.get(UserSettings.launchCount), 0) // back to default
    }

    // MARK: - Initial values

    func testInitialValuesArePreserved() {
        let seeded = InMemorySettingsStorageProvider(initial: [
            "test.launchCount": 7
        ])
        XCTAssertEqual(seeded.get(UserSettings.launchCount), 7)
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

        store.set(1, for: UserSettings.launchCount)
        store.set("hi", for: UserSettings.displayName)

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(receivedKeys, ["test.launchCount", "test.displayName"])
    }

    func testRemoveEmitsChange() {
        store.set(1, for: UserSettings.launchCount)

        let expectation = expectation(description: "remove emits")
        store.changes
            .sink { key in
                XCTAssertEqual(key, "test.launchCount")
                expectation.fulfill()
            }
            .store(in: &cancellables)

        store.remove(UserSettings.launchCount)
        wait(for: [expectation], timeout: 1.0)
    }

    func testPublisherForKeyEmitsCurrentAndSubsequentValues() {
        store.set(5, for: UserSettings.launchCount)

        let expectation = expectation(description: "publisher emits")
        var received: [Int] = []

        store.publisher(for: UserSettings.launchCount)
            .sink { value in
                received.append(value)
                if received.count == 3 { expectation.fulfill() }
            }
            .store(in: &cancellables)

        store.set(6, for: UserSettings.launchCount)
        store.set(7, for: UserSettings.launchCount)

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(received, [5, 6, 7])
    }

    func testPublisherIgnoresOtherKeys() {
        let expectation = expectation(description: "only target key")
        var received: [Int] = []

        store.publisher(for: UserSettings.launchCount)
            .sink { value in
                received.append(value)
                if received.count == 2 { expectation.fulfill() }
            }
            .store(in: &cancellables)

        store.set("ignored", for: UserSettings.displayName) // should NOT trigger
        store.set(99, for: UserSettings.launchCount)         // should trigger

        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(received, [0, 99]) // initial default + new value
    }

    // MARK: - AsyncStream

    func testAsyncStreamYieldsValues() async {
        store.set(10, for: UserSettings.launchCount)

        let stream = store.values(for: UserSettings.launchCount)
        var iterator = stream.makeAsyncIterator()

        let initial = await iterator.next()
        XCTAssertEqual(initial, 10)

        // Schedule the update after the iterator is awaiting.
        Task {
            try? await Task.sleep(nanoseconds: 50_000_000) // 50ms
            self.store.set(11, for: UserSettings.launchCount)
        }

        let next = await iterator.next()
        XCTAssertEqual(next, 11)
    }
}

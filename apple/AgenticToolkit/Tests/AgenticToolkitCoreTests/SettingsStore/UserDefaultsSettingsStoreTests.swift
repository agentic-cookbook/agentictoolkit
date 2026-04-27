import XCTest
import Combine
@testable import AgenticToolkitCore

@MainActor
final class UserDefaultsSettingsStoreTests: XCTestCase {
    var defaults: UserDefaults!
    var store: UserDefaultsSettingsStorageProvider!
    var cancellables: Set<AnyCancellable>!
    let suiteName = "SettingsKitTests"

    override func setUp() async throws {
        try await super.setUp()
        // Use an isolated suite so tests don't pollute the standard defaults.
        defaults = UserDefaults(suiteName: suiteName)
        defaults.removePersistentDomain(forName: suiteName)
        store = UserDefaultsSettingsStorageProvider(defaults: defaults)
        cancellables = []
    }

    override func tearDown() async throws {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        store = nil
        cancellables = nil
        try await super.tearDown()
    }

    // MARK: - Defaults

    func testReturnsDefaultWhenAbsent() {
        XCTAssertEqual(store.get(UserSettings.launchCount), 0)
        XCTAssertEqual(store.get(UserSettings.displayName), "Anonymous")
    }

    // MARK: - Primitives stored natively

    func testBoolRoundTrip() {
        store.set(true, for: UserSettings.hasCompletedOnboarding)
        XCTAssertEqual(store.get(UserSettings.hasCompletedOnboarding), true)
        // Verify stored natively (not as JSON Data).
        XCTAssertNotNil(defaults.object(forKey: "test.hasCompletedOnboarding") as? Bool)
    }

    func testIntRoundTrip() {
        store.set(42, for: UserSettings.launchCount)
        XCTAssertEqual(store.get(UserSettings.launchCount), 42)
    }

    func testStringRoundTrip() {
        store.set("Hello, world!", for: UserSettings.displayName)
        XCTAssertEqual(store.get(UserSettings.displayName), "Hello, world!")
    }

    func testDoubleRoundTrip() {
        store.set(0.875, for: UserSettings.volume)
        XCTAssertEqual(store.get(UserSettings.volume), 0.875, accuracy: 0.0001)
    }

    func testDateRoundTrip() {
        let now = Date()
        store.set(now, for: UserSettings.lastOpened)
        XCTAssertEqual(
            store.get(UserSettings.lastOpened).timeIntervalSince1970,
            now.timeIntervalSince1970,
            accuracy: 0.001
        )
    }

    // MARK: - Collections (JSON-encoded)

    func testStringArrayRoundTrip() {
        let values = ["alpha", "beta", "gamma"]
        store.set(values, for: UserSettings.recentSearches)
        XCTAssertEqual(store.get(UserSettings.recentSearches), values)
        // Should be stored as Data (JSON), not as a native array.
        XCTAssertNotNil(defaults.data(forKey: "test.recentSearches"))
    }

    func testIntArrayRoundTrip() {
        store.set([1, 1, 2, 3, 5], for: UserSettings.favoriteNumbers)
        XCTAssertEqual(store.get(UserSettings.favoriteNumbers), [1, 1, 2, 3, 5])
    }

    func testEmptyArrayRoundTrip() {
        store.set([], for: UserSettings.recentSearches)
        XCTAssertEqual(store.get(UserSettings.recentSearches), [])
        XCTAssertTrue(store.contains(UserSettings.recentSearches))
    }

    // MARK: - Codable struct

    func testCodableStructRoundTrip() {
        let prefs = UserPreferences(
            displayName: "Brian",
            theme: .dark,
            notificationsEnabled: false
        )
        store.set(prefs, for: UserSettings.userPreferences)
        XCTAssertEqual(store.get(UserSettings.userPreferences), prefs)
    }

    func testCodableStructFallsBackToDefaultOnCorruptedData() {
        // Inject garbage Data under the key.
        defaults.set(Data([0xFF, 0x00, 0xAB]), forKey: "test.userPreferences")
        let result = store.get(UserSettings.userPreferences)
        XCTAssertEqual(result, UserSettings.userPreferences.defaultValue)
    }

    // MARK: - contains / remove

    func testContainsAndRemove() {
        XCTAssertFalse(store.contains(UserSettings.launchCount))
        store.set(5, for: UserSettings.launchCount)
        XCTAssertTrue(store.contains(UserSettings.launchCount))

        store.remove(UserSettings.launchCount)
        XCTAssertFalse(store.contains(UserSettings.launchCount))
        XCTAssertEqual(store.get(UserSettings.launchCount), 0)
    }

    // MARK: - Persistence across instances

    func testValuesPersistAcrossStoreInstances() {
        store.set(123, for: UserSettings.launchCount)
        store.set("Persistent", for: UserSettings.displayName)

        // New store, same UserDefaults suite — should see the values.
        let newStore = UserDefaultsSettingsStorageProvider(defaults: defaults)
        XCTAssertEqual(newStore.get(UserSettings.launchCount), 123)
        XCTAssertEqual(newStore.get(UserSettings.displayName), "Persistent")
    }

    // MARK: - Change notifications

    func testSetEmitsChange() {
        let expectation = expectation(description: "change emitted")
        store.changes
            .sink { key in
                XCTAssertEqual(key, "test.launchCount")
                expectation.fulfill()
            }
            .store(in: &cancellables)

        store.set(1, for: UserSettings.launchCount)
        wait(for: [expectation], timeout: 1.0)
    }

    func testPublisherForKeyEmitsInitialAndSubsequent() {
        store.set(10, for: UserSettings.launchCount)

        let expectation = expectation(description: "publisher")
        var received: [Int] = []

        store.publisher(for: UserSettings.launchCount)
            .sink { value in
                received.append(value)
                if received.count == 2 { expectation.fulfill() }
            }
            .store(in: &cancellables)

        store.set(20, for: UserSettings.launchCount)
        wait(for: [expectation], timeout: 1.0)

        XCTAssertEqual(received, [10, 20])
    }
}

import XCTest
import Combine
@testable import AgenticToolkitCore

@MainActor
final class SqliteStorageProviderTests: XCTestCase {
    var dbURL: URL!
    var store: SqliteStorageProvider!
    var cancellables: Set<AnyCancellable>!

    override func setUp() async throws {
        try await super.setUp()
        dbURL = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("SqliteSettings-\(UUID().uuidString).sqlite")
        store = try SqliteStorageProvider(path: dbURL.path)
        cancellables = []
    }

    override func tearDown() async throws {
        store = nil
        if let dbURL { try? FileManager.default.removeItem(at: dbURL) }
        dbURL = nil
        cancellables = nil
        try await super.tearDown()
    }

    // MARK: - Defaults

    func testReturnsDefaultsWhenEmpty() {
        XCTAssertEqual(store.get(UserSettings.hasCompletedOnboarding), false)
        XCTAssertEqual(store.get(UserSettings.launchCount), 0)
        XCTAssertEqual(store.get(UserSettings.displayName), "Anonymous")
    }

    // MARK: - Primitive round-trips

    func testBoolRoundTrip() {
        store.set(true, for: UserSettings.hasCompletedOnboarding)
        XCTAssertEqual(store.get(UserSettings.hasCompletedOnboarding), true)
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

    // MARK: - Collections

    func testStringArrayRoundTrip() {
        let values = ["alpha", "beta", "gamma"]
        store.set(values, for: UserSettings.recentSearches)
        XCTAssertEqual(store.get(UserSettings.recentSearches), values)
    }

    func testIntArrayRoundTrip() {
        store.set([1, 1, 2, 3, 5], for: UserSettings.favoriteNumbers)
        XCTAssertEqual(store.get(UserSettings.favoriteNumbers), [1, 1, 2, 3, 5])
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

    func testCodableStructFallsBackToDefaultOnCorruptedData() throws {
        // Inject garbage by writing a String value under a key that expects UserPreferences.
        // Since the JSON decoder will fail, the get should return the key's default value.
        // Use the underlying JSON path: write a String wrapped value.
        let badData = Data("not json".utf8)
        // Open a parallel handle and inject bytes — easier: set a String to the same key name
        // through a manually-crafted JSON. The simplest hack: set a nonsense type's blob via a
        // separate temporary key won't trigger the path. Instead, rely on the implementation:
        // overwriting userPreferences with a Codable that decodes to a different shape will
        // fail to decode UserPreferences.
        struct Decoy: Codable, Sendable { let foo: String }
        let decoyKey = UserSetting<Decoy>("test.userPreferences", default: Decoy(foo: ""))
        store.set(Decoy(foo: "bar"), for: decoyKey)

        let result = store.get(UserSettings.userPreferences)
        XCTAssertEqual(result, UserSettings.userPreferences.defaultValue)
        _ = badData
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

    func testValuesPersistAcrossInstances() throws {
        store.set(123, for: UserSettings.launchCount)
        store.set("Persistent", for: UserSettings.displayName)

        // Open a fresh store on the same file.
        let newStore = try SqliteStorageProvider(path: dbURL.path)
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

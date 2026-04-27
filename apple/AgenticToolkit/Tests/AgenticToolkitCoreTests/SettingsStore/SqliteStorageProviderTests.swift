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
        XCTAssertEqual(store.get(.hasCompletedOnboarding), false)
        XCTAssertEqual(store.get(.launchCount), 0)
        XCTAssertEqual(store.get(.displayName), "Anonymous")
    }

    // MARK: - Primitive round-trips

    func testBoolRoundTrip() {
        store.set(true, for: .hasCompletedOnboarding)
        XCTAssertEqual(store.get(.hasCompletedOnboarding), true)
    }

    func testIntRoundTrip() {
        store.set(42, for: .launchCount)
        XCTAssertEqual(store.get(.launchCount), 42)
    }

    func testStringRoundTrip() {
        store.set("Hello, world!", for: .displayName)
        XCTAssertEqual(store.get(.displayName), "Hello, world!")
    }

    func testDoubleRoundTrip() {
        store.set(0.875, for: .volume)
        XCTAssertEqual(store.get(.volume), 0.875, accuracy: 0.0001)
    }

    func testDateRoundTrip() {
        let now = Date()
        store.set(now, for: .lastOpened)
        XCTAssertEqual(
            store.get(.lastOpened).timeIntervalSince1970,
            now.timeIntervalSince1970,
            accuracy: 0.001
        )
    }

    // MARK: - Collections

    func testStringArrayRoundTrip() {
        let values = ["alpha", "beta", "gamma"]
        store.set(values, for: .recentSearches)
        XCTAssertEqual(store.get(.recentSearches), values)
    }

    func testIntArrayRoundTrip() {
        store.set([1, 1, 2, 3, 5], for: .favoriteNumbers)
        XCTAssertEqual(store.get(.favoriteNumbers), [1, 1, 2, 3, 5])
    }

    // MARK: - Codable struct

    func testCodableStructRoundTrip() {
        let prefs = UserPreferences(
            displayName: "Brian",
            theme: .dark,
            notificationsEnabled: false
        )
        store.set(prefs, for: .userPreferences)
        XCTAssertEqual(store.get(.userPreferences), prefs)
    }

    func testCodableStructFallsBackToDefaultOnCorruptedData() throws {
        // Inject garbage by writing a String value under a key that expects UserPreferences.
        // Since the JSON decoder will fail, the get should return the key's default value.
        // Use the underlying JSON path: write a String wrapped value.
        let badData = "not json".data(using: .utf8)!
        // Open a parallel handle and inject bytes — easier: set a String to the same key name
        // through a manually-crafted JSON. The simplest hack: set a nonsense type's blob via a
        // separate temporary key won't trigger the path. Instead, rely on the implementation:
        // overwriting userPreferences with a Codable that decodes to a different shape will
        // fail to decode UserPreferences.
        struct Decoy: Codable, Sendable { let foo: String }
        let decoyKey = StoredSetting<Decoy>.Key("test.userPreferences", default: Decoy(foo: ""))
        store.set(Decoy(foo: "bar"), for: decoyKey)

        let result = store.get(.userPreferences)
        XCTAssertEqual(result, StoredSetting<UserPreferences>.Key.userPreferences.defaultValue)
        _ = badData
    }

    // MARK: - contains / remove

    func testContainsAndRemove() {
        XCTAssertFalse(store.contains(.launchCount))
        store.set(5, for: .launchCount)
        XCTAssertTrue(store.contains(.launchCount))

        store.remove(.launchCount)
        XCTAssertFalse(store.contains(.launchCount))
        XCTAssertEqual(store.get(.launchCount), 0)
    }

    // MARK: - Persistence across instances

    func testValuesPersistAcrossInstances() throws {
        store.set(123, for: .launchCount)
        store.set("Persistent", for: .displayName)

        // Open a fresh store on the same file.
        let newStore = try SqliteStorageProvider(path: dbURL.path)
        XCTAssertEqual(newStore.get(.launchCount), 123)
        XCTAssertEqual(newStore.get(.displayName), "Persistent")
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

        store.set(1, for: .launchCount)
        wait(for: [expectation], timeout: 1.0)
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

    func testPublisherForKeyEmitsInitialAndSubsequent() {
        store.set(10, for: .launchCount)

        let expectation = expectation(description: "publisher")
        var received: [Int] = []
        store.publisher(for: .launchCount)
            .sink { value in
                received.append(value)
                if received.count == 2 { expectation.fulfill() }
            }
            .store(in: &cancellables)

        store.set(20, for: .launchCount)
        wait(for: [expectation], timeout: 1.0)
        XCTAssertEqual(received, [10, 20])
    }
}

import XCTest
import Combine
@testable import AgenticToolkitCore

@MainActor
final class KeychainSecureStorageProviderTests: XCTestCase {
    var serviceID: String!
    var originalService: String!
    var store: KeychainSecureSettingsStorageProvider!
    var cancellables: Set<AnyCancellable>!

    // Tests use unique-per-run service identifiers to isolate from concurrent test runs
    // and from the real bundle's keychain entries.
    override func setUp() async throws {
        try await super.setUp()
        // Capture the global so tearDown can restore it: KeychainHelperTests (same
        // bundle) documents that it relies on the default service, so this suite must
        // not leave its per-run UUID service behind on the shared global.
        originalService = KeychainHelper.service
        serviceID = "KeychainSettingsTests-\(UUID().uuidString)"
        store = KeychainSecureSettingsStorageProvider(service: serviceID)
        cancellables = []
    }

    override func tearDown() async throws {
        // Cancel subscriptions FIRST: otherwise the cleanup removes below re-emit
        // change notifications into a test's still-live sink, fulfilling an already
        // satisfied XCTestExpectation and tripping its over-fulfillment assertion.
        cancellables = nil
        // Best-effort: remove every key our tests touch.
        store.remove(UserSettings.displayName)
        store.remove(UserSettings.userPreferences)
        store.remove(UserSettings.launchCount)
        store.remove(UserSettings.hasCompletedOnboarding)
        store = nil
        // Restore the global service this suite overrode in setUp.
        KeychainHelper.service = originalService
        originalService = nil
        try await super.tearDown()
    }

    // MARK: - Defaults

    func testReturnsDefaultsWhenEmpty() {
        XCTAssertEqual(store.get(UserSettings.displayName), "Anonymous")
        XCTAssertEqual(store.get(UserSettings.launchCount), 0)
    }

    // MARK: - String round-trip (fast path — stored as raw string)

    func testStringRoundTrip() {
        store.set("api-key-12345", for: UserSettings.displayName)
        XCTAssertEqual(store.get(UserSettings.displayName), "api-key-12345")
    }

    func testStringValueIsStoredRawNotJSONQuoted() {
        // The fast path stores Strings without JSON quoting so keychain entries are readable.
        store.set("hello", for: UserSettings.displayName)
        // Read directly via KeychainHelper, bypassing the provider's decoder.
        let raw = KeychainHelper.get(forKey: "test.displayName")
        XCTAssertEqual(raw, "hello")  // not "\"hello\""
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
        // Inject non-JSON garbage under the key.
        KeychainHelper.set("not valid json {{{", forKey: "test.userPreferences")

        let result = store.get(UserSettings.userPreferences)
        XCTAssertEqual(result, UserSettings.userPreferences.defaultValue)
    }

    // MARK: - contains / remove

    func testContainsAndRemove() {
        XCTAssertFalse(store.contains(UserSettings.displayName))
        store.set("secret", for: UserSettings.displayName)
        XCTAssertTrue(store.contains(UserSettings.displayName))

        store.remove(UserSettings.displayName)
        XCTAssertFalse(store.contains(UserSettings.displayName))
        XCTAssertEqual(store.get(UserSettings.displayName), "Anonymous")
    }

    // MARK: - Change notifications

    func testSetEmitsChange() {
        let expectation = expectation(description: "change emitted")
        store.changes
            .sink { key in
                XCTAssertEqual(key, "test.displayName")
                expectation.fulfill()
            }
            .store(in: &cancellables)

        store.set("token", for: UserSettings.displayName)
        wait(for: [expectation], timeout: 1.0)
    }

    func testRemoveEmitsChange() {
        store.set("v", for: UserSettings.displayName)

        let expectation = expectation(description: "remove emits")
        store.changes
            .sink { key in
                XCTAssertEqual(key, "test.displayName")
                expectation.fulfill()
            }
            .store(in: &cancellables)

        store.remove(UserSettings.displayName)
        wait(for: [expectation], timeout: 1.0)
    }

    // MARK: - isSecure flag

    func testProviderReportsSecure() {
        XCTAssertTrue(store.isSecure)
    }
}

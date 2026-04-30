import Testing
import Foundation
@testable import AgenticToolkitCore

/// These tests touch the real macOS Keychain. They use a unique account key
/// per test (UUID-suffixed) to avoid cross-test collisions under parallel
/// execution, and clean up after themselves via `delete(forKey:)`.
///
/// Tests do NOT mutate `KeychainHelper.service` (it's a global static), so
/// the test keychain service is whatever the test host's bundle identifier
/// resolves to at runtime. Isolation is per-account-key, not per-service.
@Suite("KeychainHelper")
struct KeychainHelperTests {

    private func uniqueKey(_ prefix: String = "kctest") -> String {
        "\(prefix)-\(UUID().uuidString)"
    }

    @Test("set then get round-trips the value")
    func setGetRoundTrip() {
        let key = uniqueKey()
        defer { KeychainHelper.delete(forKey: key) }

        #expect(KeychainHelper.set("hello-world", forKey: key))
        #expect(KeychainHelper.get(forKey: key) == "hello-world")
    }

    @Test("get returns nil for missing key")
    func getMissing() {
        let key = uniqueKey("missing")
        #expect(KeychainHelper.get(forKey: key) == nil)
    }

    @Test("exists returns true after set, false after delete")
    func existsLifecycle() {
        let key = uniqueKey()
        defer { KeychainHelper.delete(forKey: key) }

        #expect(!KeychainHelper.exists(forKey: key))

        #expect(KeychainHelper.set("x", forKey: key))
        #expect(KeychainHelper.exists(forKey: key))

        #expect(KeychainHelper.delete(forKey: key))
        #expect(!KeychainHelper.exists(forKey: key))
    }

    @Test("set overwrites existing value for same key")
    func setOverwrites() {
        let key = uniqueKey()
        defer { KeychainHelper.delete(forKey: key) }

        #expect(KeychainHelper.set("first", forKey: key))
        #expect(KeychainHelper.set("second", forKey: key))
        #expect(KeychainHelper.get(forKey: key) == "second")
    }

    @Test("delete returns true for non-existent key")
    func deleteMissingReturnsTrue() {
        // KeychainHelper.delete is documented to treat "not found" as success
        // so repeated cleanup calls don't raise spurious failures.
        let key = uniqueKey("ghost")
        #expect(KeychainHelper.delete(forKey: key))
    }

    @Test("set stores empty string and get returns it")
    func emptyStringRoundTrip() {
        let key = uniqueKey()
        defer { KeychainHelper.delete(forKey: key) }

        #expect(KeychainHelper.set("", forKey: key))
        #expect(KeychainHelper.get(forKey: key) == "")
        #expect(KeychainHelper.exists(forKey: key))
    }

    @Test("set stores unicode and get returns identical bytes")
    func unicodeRoundTrip() {
        let key = uniqueKey()
        defer { KeychainHelper.delete(forKey: key) }

        let value = "日本語 🔑 émoji\n\t"
        #expect(KeychainHelper.set(value, forKey: key))
        #expect(KeychainHelper.get(forKey: key) == value)
    }

    @Test("isolated keys don't interfere")
    func keyIsolation() {
        let keyA = uniqueKey("a")
        let keyB = uniqueKey("b")
        defer {
            KeychainHelper.delete(forKey: keyA)
            KeychainHelper.delete(forKey: keyB)
        }

        #expect(KeychainHelper.set("alpha", forKey: keyA))
        #expect(KeychainHelper.set("beta", forKey: keyB))

        #expect(KeychainHelper.get(forKey: keyA) == "alpha")
        #expect(KeychainHelper.get(forKey: keyB) == "beta")

        #expect(KeychainHelper.delete(forKey: keyA))
        #expect(KeychainHelper.get(forKey: keyA) == nil)
        #expect(KeychainHelper.get(forKey: keyB) == "beta")
    }
}

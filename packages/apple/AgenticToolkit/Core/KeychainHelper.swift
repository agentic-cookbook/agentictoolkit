import Foundation
import Security
import os

/// Provides simple CRUD operations for storing secrets in the macOS Keychain.
/// Uses generic password items scoped to a configurable service identifier.
public enum KeychainHelper {

    /// The Keychain service identifier. Defaults to the main bundle identifier.
    nonisolated(unsafe) public static var service: String = Bundle.main.bundleIdentifier ?? "com.agentictoolkit"

    /// Optional shared Keychain access group. When set, items are scoped to this
    /// group so multiple signed binaries (e.g. an app and its daemon) carrying the
    /// matching `keychain-access-groups` entitlement can share them. `nil` (the
    /// default) preserves the original per-binary behavior.
    nonisolated(unsafe) public static var accessGroup: String?

    /// Builds the base generic-password query for an account key. When an access
    /// group is in play, scopes the item to it and forces the macOS data-protection
    /// keychain (required for access groups on macOS).
    static func makeQuery(account: String, accessGroup: String? = KeychainHelper.accessGroup) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        if let accessGroup {
            query[kSecAttrAccessGroup as String] = accessGroup
            query[kSecUseDataProtectionKeychain as String] = true
        }
        return query
    }

    /// Stores a value in the Keychain for the given account key.
    /// Overwrites any existing value for the same key.
    @discardableResult
    public static func set(_ value: String, forKey key: String) -> Bool {
        let data = Data(value.utf8)
        delete(forKey: key)

        var query = makeQuery(account: key)
        query[kSecValueData as String] = data

        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            logger.error("Keychain set failed for '\(key, privacy: .public)': \(status)")
        }
        return status == errSecSuccess
    }

    /// Retrieves a value from the Keychain for the given account key.
    public static func get(forKey key: String) -> String? {
        var query = makeQuery(account: key)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            if status != errSecItemNotFound {
                logger.error("Keychain get failed for '\(key, privacy: .public)': \(status)")
            }
            return nil
        }

        return String(data: data, encoding: .utf8)
    }

    /// Deletes the Keychain item for the given account key.
    @discardableResult
    public static func delete(forKey key: String) -> Bool {
        let query = makeQuery(account: key)

        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    /// Returns whether a value exists in the Keychain for the given key.
    public static func exists(forKey key: String) -> Bool {
        var query = makeQuery(account: key)
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        return SecItemCopyMatching(query as CFDictionary, nil) == errSecSuccess
    }
}

extension KeychainHelper: Loggable {
    public static nonisolated let logger = makeLogger()
}

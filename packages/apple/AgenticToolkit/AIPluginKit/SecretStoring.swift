import Foundation
import AgenticToolkitCore

/// Indirection over the Keychain so tests can substitute an in-memory store and
/// never touch the real login keychain. The secret-storage abstraction is a
/// separate concern from key naming — hosts bring their own key convention.
public protocol SecretStoring: Sendable {
    func get(forKey key: String) -> String?
    @discardableResult func set(_ value: String, forKey key: String) -> Bool
    /// Removes a stored secret. The removal path: when the host clears a credential
    /// field it pushes an empty value, and the daemon deletes the entry rather than
    /// keeping a stale key. Idempotent — deleting an absent key is not an error.
    @discardableResult func delete(forKey key: String) -> Bool

    /// Removes a secret written by a PRE-pin daemon, which had no bundle id and so
    /// stored under the `KeychainHelper` fallback service (`com.agentictoolkit`)
    /// rather than today's pinned daemon service. Used only by the one-time legacy
    /// cleanup — the current `delete` targets the pinned service, where these
    /// pre-upgrade credentials never lived, so without this the real old key would
    /// linger. Idempotent.
    @discardableResult func deleteLegacy(forKey key: String) -> Bool
}

/// Production `SecretStoring` backed by the host process's `KeychainHelper` namespace.
public struct KeychainSecretStore: SecretStoring {
    /// The pre-pin fallback service a bundle-id-less daemon used before hosts
    /// pinned an explicit one. Mirrors `KeychainHelper`'s own default fallback.
    public static let legacyService = "com.agentictoolkit"

    public init() {}

    public func get(forKey key: String) -> String? { KeychainHelper.get(forKey: key) }

    @discardableResult
    public func set(_ value: String, forKey key: String) -> Bool { KeychainHelper.set(value, forKey: key) }

    @discardableResult
    public func delete(forKey key: String) -> Bool { KeychainHelper.delete(forKey: key) }

    @discardableResult
    public func deleteLegacy(forKey key: String) -> Bool {
        // Delete under the old fallback service by briefly retargeting the global
        // service. Callers must serialize this with their other Keychain access
        // (stenographer runs it only inside its one-time, lock-serialized legacy
        // cleanup), so no concurrent access races the swap.
        let pinned = KeychainHelper.service
        KeychainHelper.service = Self.legacyService
        defer { KeychainHelper.service = pinned }
        return KeychainHelper.delete(forKey: key)
    }
}

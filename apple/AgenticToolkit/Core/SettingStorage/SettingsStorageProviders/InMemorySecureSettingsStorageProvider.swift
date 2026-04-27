import Foundation
import Combine

/// A `SecureSettingsStorageProvider` backed by an in-memory dictionary.
///
/// Useful for tests and SwiftUI previews where you want SettingsStore to behave
/// the same shape as production (separate routing slot for secure keys) without
/// touching the real Keychain.
@MainActor
public final class InMemorySecureSettingsStorageProvider: SecureSettingsStorageProvider {
    private let inner: InMemorySettingsStorageProvider

    public var changes: AnyPublisher<String, Never> { inner.changes }

    public init(initial: [String: Any] = [:]) {
        self.inner = InMemorySettingsStorageProvider(initial: initial)
    }

    public func get<Value: Codable>(_ key: any StorableSetting<Value>) -> Value {
        inner.get(key)
    }

    public func set<Value: Codable>(_ value: Value, for key: any StorableSetting<Value>) {
        inner.set(value, for: key)
    }

    public func remove<Value: Codable>(_ key: any StorableSetting<Value>) {
        inner.remove(key)
    }

    public func contains<Value: Codable>(_ key: any StorableSetting<Value>) -> Bool {
        inner.contains(key)
    }
}

import Foundation
import Combine

/// A type-safe key/value store for user preferences.
///
/// Conforming types provide get/set/remove/contains operations keyed by `SettingsStore.SettingKey`,
/// plus a Combine publisher and an `AsyncStream` for observing changes.
@MainActor
public protocol SettingsStorageProvider: AnyObject {
    
    typealias ValueType = Codable & Sendable
    
    /// Retrieves a value for the given key, returning the key's default if absent.
    func get<Value: ValueType>(_ key: any StorableSetting<Value>) -> Value

    /// Stores a value for the given key.
    func set<Value: ValueType>(_ value: Value, for key: any StorableSetting<Value>)

    /// Removes the stored value, so subsequent reads return the default.
    func remove<Value: ValueType>(_ key: any StorableSetting<Value>)

    /// Checks whether a value has been explicitly stored.
    func contains<Value: ValueType>(_ key: any StorableSetting<Value>) -> Bool

    /// Publishes the key name whenever any value changes (set or removed).
    var changes: AnyPublisher<String, Never> { get }
}

public extension SettingsStorageProvider {
    /// Publishes values for a specific key, starting with the current value.
    func publisher<Value: ValueType>(for key: any StorableSetting<Value>) -> AnyPublisher<Value, Never> {
        let currentValue = get(key)
        return changes
            .filter { $0 == key.name }
            .map { [weak self] _ -> Value in
                self?.get(key) ?? key.defaultValue
            }
            .prepend(currentValue)
            .eraseToAnyPublisher()
    }
    
    /// An async sequence of values for a specific key, starting with the current value.
    func values<Value: ValueType>(for key: any StorableSetting<Value>) -> AsyncStream<Value> {
        AsyncStream { continuation in
            nonisolated(unsafe) let cancellable = publisher(for: key).sink { value in
                continuation.yield(value)
            }
            continuation.onTermination = { _ in
                cancellable.cancel()
            }
        }
    }
    
    /// Is this provider secure?
    var isSecure: Bool { false }
}

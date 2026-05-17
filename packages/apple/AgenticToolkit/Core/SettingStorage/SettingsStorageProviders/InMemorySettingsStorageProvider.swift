import Foundation
import Combine

/// A `SettingsStorageProvider` backed by an in-memory dictionary.
///
/// Useful for tests and previews. Thread-safe via an internal serial queue.
public final class InMemorySettingsStorageProvider: SettingsStorageProvider {
    private var storage: [String: Any] = [:]
    private let queue = DispatchQueue(label: "InMemorySettingsStorageProvider", attributes: .concurrent)
    private let changeSubject = PassthroughSubject<String, Never>()

    public var changes: AnyPublisher<String, Never> {
        changeSubject.eraseToAnyPublisher()
    }

    public init(initial: [String: Any] = [:]) {
        self.storage = initial
    }

    public func get<Value: Codable>(_ key: any StorableSetting<Value>) -> Value {
        queue.sync {
            (storage[key.name] as? Value) ?? key.defaultValue
        }
    }

    public func set<Value: Codable>(_ value: Value, for key: any StorableSetting<Value>) {
        queue.sync(flags: .barrier) {
            storage[key.name] = value
        }
        changeSubject.send(key.name)
    }

    public func remove<Value: Codable>(_ key: any StorableSetting<Value>) {
        queue.sync(flags: .barrier) {
            _ = storage.removeValue(forKey: key.name)
        }
        changeSubject.send(key.name)
    }

    public func contains<Value: Codable>(_ key: any StorableSetting<Value>) -> Bool {
        queue.sync {
            storage[key.name] != nil
        }
    }
}

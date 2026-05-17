import Foundation
import Combine

/// A `SettingsStorageProvider` backed by `UserDefaults`.
///
/// Primitive types (`Int`, `Double`, `Float`, `Bool`, `String`, `Data`, `URL`, `Date`)
/// are stored natively. Arrays and Codable types are JSON-encoded.
public final class UserDefaultsSettingsStorageProvider: SettingsStorageProvider {
    private let defaults: UserDefaults
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let changeSubject = PassthroughSubject<String, Never>()

    public var changes: AnyPublisher<String, Never> {
        changeSubject.eraseToAnyPublisher()
    }

    public init(
        defaults: UserDefaults = .standard,
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.defaults = defaults
        self.encoder = encoder
        self.decoder = decoder
    }

    public func get<Value: Codable>(_ key: any StorableSetting<Value>) -> Value {
        // Fast path for primitives that UserDefaults stores natively.
        if Self.isNativelySupported(Value.self),
           let primitive = defaults.object(forKey: key.name) as? Value {
            return primitive
        }

        // Decode complex types (arrays, dictionaries, structs) from stored Data.
        if let data = defaults.data(forKey: key.name),
           let value = try? decoder.decode(Value.self, from: data) {
            return value
        }

        return key.defaultValue
    }

    public func set<Value: Codable>(_ value: Value, for key: any StorableSetting<Value>) {
        if Self.isNativelySupported(Value.self) {
            defaults.set(value, forKey: key.name)
        } else if let data = try? encoder.encode(value) {
            defaults.set(data, forKey: key.name)
        } else {
            return
        }
        changeSubject.send(key.name)
    }

    public func remove<Value: Codable>(_ key: any StorableSetting<Value>) {
        defaults.removeObject(forKey: key.name)
        changeSubject.send(key.name)
    }

    public func contains<Value: Codable>(_ key: any StorableSetting<Value>) -> Bool {
        defaults.object(forKey: key.name) != nil
    }

    /// Types that `UserDefaults` stores natively without JSON encoding.
    private static func isNativelySupported<T>(_ type: T.Type) -> Bool {
        type == Int.self || type == Double.self || type == Float.self ||
        type == Bool.self || type == String.self || type == Data.self ||
        type == URL.self  || type == Date.self
    }
}

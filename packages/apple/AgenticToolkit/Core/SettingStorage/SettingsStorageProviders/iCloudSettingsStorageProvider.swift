@preconcurrency import Foundation
import Combine

#if canImport(UIKit) || canImport(AppKit)

/// A `SettingsStorageProvider` backed by `NSUbiquitousKeyValueStore` for iCloud-synced settings.
///
/// iCloud's key-value store is the appropriate backing for small user preferences
/// (≤ 1MB total, ≤ 1024 keys, ≤ 1MB per value). For larger or relational data,
/// use full CloudKit records instead.
///
/// Conflict resolution is last-write-wins, handled by iCloud itself. External
/// changes (from another device) are surfaced through the `changes` publisher.
@MainActor
// swiftlint:disable:next type_name
public final class iCloudSettingsStorageProvider: SettingsStorageProvider {
    private let store: NSUbiquitousKeyValueStore
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let changeSubject = PassthroughSubject<String, Never>()
    nonisolated(unsafe) private var observer: NSObjectProtocol?

    public var changes: AnyPublisher<String, Never> {
        changeSubject.eraseToAnyPublisher()
    }

    public init(
        store: NSUbiquitousKeyValueStore = .default,
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        self.store = store
        self.encoder = encoder
        self.decoder = decoder

        // Forward external iCloud changes through our publisher.
        self.observer = NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store,
            queue: .main
        ) { [weak self] notification in
            // Pull keys out before crossing the MainActor boundary; `notification`
            // (NSNotification) isn't Sendable, but `[String]` is.
            let keys = notification.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String] ?? []
            MainActor.assumeIsolated {
                guard let self else { return }
                for key in keys {
                    self.changeSubject.send(key)
                }
            }
        }

        store.synchronize()
    }

    deinit {
        if let observer = observer {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    public func get<Value: Codable>(_ key: any StorableSetting<Value>) -> Value {
        if Self.isNativelySupported(Value.self) {
            // NSUbiquitousKeyValueStore stores integers as Int64; bridge if the caller asked for Int.
            if Value.self == Int.self,
               let int64 = store.object(forKey: key.name) as? Int64,
               let bridged = Int(exactly: int64) as? Value {
                return bridged
            }
            if let primitive = store.object(forKey: key.name) as? Value {
                return primitive
            }
        }
        if let data = store.data(forKey: key.name),
           let value = try? decoder.decode(Value.self, from: data) {
            return value
        }
        return key.defaultValue
    }

    public func set<Value: Codable>(_ value: Value, for key: any StorableSetting<Value>) {
        if Self.isNativelySupported(Value.self) {
            // Promote Int → Int64 for the underlying store.
            if let intValue = value as? Int {
                store.set(Int64(intValue), forKey: key.name)
            } else {
                store.set(value, forKey: key.name)
            }
        } else if let data = try? encoder.encode(value) {
            store.set(data, forKey: key.name)
        } else {
            return
        }
        store.synchronize()
        changeSubject.send(key.name)
    }

    public func remove<Value: Codable>(_ key: any StorableSetting<Value>) {
        store.removeObject(forKey: key.name)
        store.synchronize()
        changeSubject.send(key.name)
    }

    public func contains<Value: Codable>(_ key: any StorableSetting<Value>) -> Bool {
        store.object(forKey: key.name) != nil
    }

    private static func isNativelySupported<T>(_ type: T.Type) -> Bool {
        // NSUbiquitousKeyValueStore supports a slightly narrower set than UserDefaults.
        // Notably, URL and Date are NOT natively supported — they go through Codable.
        type == Int.self || type == Int64.self || type == Double.self ||
        type == Bool.self || type == String.self || type == Data.self
    }
}

#endif

//
//  KeychainSecureSettingsStorageProvider.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/27/26.
//
import Foundation
import Combine
import os

/// A `SecureSettingsStorageProvider` backed by the macOS Keychain via `KeychainHelper`.
///
/// Values are JSON-encoded and stored as a UTF-8 String in the Keychain.
/// `String`-typed values take a fast path that stores the raw string (no JSON quoting)
/// to keep keychain entries human-readable for cases like API keys.
@MainActor
public final class KeychainSecureSettingsStorageProvider: SecureSettingsStorageProvider {

    private let encoder: JSONEncoder
    private let decoder: JSONDecoder
    private let changeSubject = PassthroughSubject<String, Never>()

    public var changes: AnyPublisher<String, Never> {
        changeSubject.eraseToAnyPublisher()
    }

    /// Creates a Keychain-backed secure settings provider.
    /// - Parameter service: Optional service identifier override. Sets `KeychainHelper.service`
    ///   when non-nil. Pass `nil` (the default) to use the bundle identifier.
    public init(
        service: String? = nil,
        encoder: JSONEncoder = JSONEncoder(),
        decoder: JSONDecoder = JSONDecoder()
    ) {
        if let service {
            KeychainHelper.service = service
        }
        self.encoder = encoder
        self.decoder = decoder
    }

    // MARK: - SettingsStorageProvider

    public func get<Value: Codable & Sendable>(_ key: any StorableSetting<Value>) -> Value {
        guard let stored = KeychainHelper.get(forKey: key.name) else {
            return key.defaultValue
        }
        // Fast path: bare string passes through without JSON quoting.
        if Value.self == String.self, let bridged = stored as? Value {
            return bridged
        }
        // General path: decode the stored UTF-8 string as JSON.
        guard
            let data = stored.data(using: .utf8),
            let value = try? decoder.decode(Value.self, from: data)
        else {
            return key.defaultValue
        }
        return value
    }

    public func set<Value: Codable & Sendable>(_ value: Value, for key: any StorableSetting<Value>) {
        let stringToStore: String?
        if Value.self == String.self, let raw = value as? String {
            stringToStore = raw
        } else if let data = try? encoder.encode(value), let utf8 = String(data: data, encoding: .utf8) {
            stringToStore = utf8
        } else {
            stringToStore = nil
        }
        guard let stringToStore else {
            Self.logger.error("Failed to encode value for secure key '\(key.name, privacy: .public)'")
            return
        }
        guard KeychainHelper.set(stringToStore, forKey: key.name) else {
            // KeychainHelper already logs the OSStatus.
            return
        }
        changeSubject.send(key.name)
    }

    public func remove<Value: Codable & Sendable>(_ key: any StorableSetting<Value>) {
        guard KeychainHelper.delete(forKey: key.name) else { return }
        changeSubject.send(key.name)
    }

    public func contains<Value: Codable & Sendable>(_ key: any StorableSetting<Value>) -> Bool {
        KeychainHelper.exists(forKey: key.name)
    }
}

extension KeychainSecureSettingsStorageProvider: Loggable {
    public static nonisolated let logger = makeLogger()
}

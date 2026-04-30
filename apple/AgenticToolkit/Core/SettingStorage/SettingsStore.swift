//
//  SettingsStore.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/27/26.
//
import Foundation
import SwiftUI
import Combine

@MainActor
open class SettingsStore: SettingsStorageProvider {

    private let settingsProvider: SettingsStorageProvider
    private let secureSettingsProvider: SecureSettingsStorageProvider

    public init(
        with settingsProvider: SettingsStorageProvider = UserDefaultsSettingsStorageProvider(),
        secureSettingsProvider: SecureSettingsStorageProvider = KeychainSecureSettingsStorageProvider()
    ) {
        self.settingsProvider = settingsProvider
        self.secureSettingsProvider = secureSettingsProvider
    }

    /// Publishes the key name whenever any value changes in either backing provider.
    public var changes: AnyPublisher<String, Never> {
        Publishers.Merge(settingsProvider.changes, secureSettingsProvider.changes)
            .eraseToAnyPublisher()
    }

    public func get<Value: Codable & Sendable>(_ key: any StorableSetting<Value>) -> Value {
        storageProvider(for: key).get(key)
    }

    public func set<Value>(_ value: Value, for key: any StorableSetting<Value>) where Value: Decodable, Value: Encodable, Value: Sendable {
        storageProvider(for: key).set(value, for: key)
    }

    public func remove<Value>(_ key: any StorableSetting<Value>) where Value: Decodable, Value: Encodable, Value: Sendable {
        storageProvider(for: key).remove(key)
    }

    public func contains<Value>(_ key: any StorableSetting<Value>) -> Bool where Value: Decodable, Value: Encodable, Value: Sendable {
        storageProvider(for: key).contains(key)
    }
}

extension SettingsStore {
    private func storageProvider<Value>(for key: any StorableSetting<Value>) -> SettingsStorageProvider {
        key.isSecure ? secureSettingsProvider : settingsProvider
    }
}

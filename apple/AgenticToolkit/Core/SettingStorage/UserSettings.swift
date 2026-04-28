//
//  UserSettings.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/27/26.
//
import Foundation
import Combine

@MainActor
public class UserSettings: SettingsStore {
    /// Client apps should create and set this
    public static var shared = UserSettings()
}

extension StorableSetting {
    public var value: Value {
        get { UserSettings.shared.get(self) }
        nonmutating set { UserSettings.shared.set(newValue, for: self) }
    }

    public func remove() {
        UserSettings.shared.remove(self)
    }

    public func existsInStore() -> Bool {
        UserSettings.shared.contains(self)
    }
}

@MainActor
public final class UserSetting<Value: Codable & Sendable>: StorableSetting, ObservableObject {

    public let name: String

    public let isSecure: Bool

    public let defaultValue: Value

    /// Mirrors the value held in `UserSettings.shared` for this key. Updates whenever
    /// the underlying store publishes a change. External callers still write via
    /// `setting.value = newValue`, which routes through the store and propagates
    /// back here through the change publisher.
    @Published public private(set) var currentValue: Value

    private var cancellable: AnyCancellable?

    public init(_ name: String, default defaultValue: Value, isSecure: Bool = false) {
        self.name = name
        self.isSecure = isSecure
        self.defaultValue = defaultValue
        self.currentValue = defaultValue

        let store = UserSettings.shared
        self.currentValue = store.get(self)
        self.cancellable = store.changes
            .filter { [name] in $0 == name }
            .sink { [weak self] _ in
                guard let self else { return }
                self.currentValue = UserSettings.shared.get(self)
            }
    }
}

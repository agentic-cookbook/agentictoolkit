//
//  UserSetting.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/28/26.
//

import Foundation
import Combine

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

@MainActor
public class UserSettingObserver<Value: Codable & Sendable> {
    private var cancellable: AnyCancellable?
    public var onChange: ((_ newValue: Value) -> Void)?

    public let setting: UserSetting<Value>

    public var value: Value {
        get { setting.currentValue }
        set { setting.value = newValue }
    }

    public init(_ setting: UserSetting<Value>, onChange: ((_ newValue: Value) -> Void)? = nil) {
        self.setting = setting
        self.onChange = onChange

        self.cancellable = setting.$currentValue
            .dropFirst()
            .sink { [weak self] newValue in
                guard let self else { return }
                self.onChange?(newValue)
            }
    }
    
}

@propertyWrapper
@MainActor
public final class ObservedSetting<Value: Codable & Sendable> {

    private let observer: UserSettingObserver<Value>

    public init(
        _ setting: UserSetting<Value>,
        onChange: @escaping (_ newValue: Value) -> Void
    ) {
        self.observer = UserSettingObserver<Value>(setting, onChange: onChange)
    }

    public var wrappedValue: Value {
        get { observer.value }
        set { observer.value = newValue }
    }

    public var projectedValue: UserSetting<Value> { observer.setting }
}

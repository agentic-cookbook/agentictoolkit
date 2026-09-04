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

        // `@Published` emits inside `willSet`, so subscribers reading
        // `setting.currentValue` synchronously would still see the prior
        // value. Hop to the next main-queue turn so the assignment has landed
        // before observers fire — matters for UI views that rebind from
        // `viewModel.value` instead of using the `newValue` parameter.
        //
        // The main *queue*, not `RunLoop.main`. A `RunLoop.main` scheduler
        // enqueues in `.default` mode only, and AppKit runs the whole of a
        // mouse-down in `.eventTracking` — so while a spacing arrow is held
        // down, or a slider dragged, nothing is delivered until the mouse
        // comes back up and the live preview the observer exists to drive
        // does not happen. The main dispatch queue is drained in every mode.
        // `ThemePaletteObserver` hit this first and documents the same
        // failure.
        self.cancellable = setting.$currentValue
            .dropFirst()
            .receive(on: DispatchQueue.main)
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

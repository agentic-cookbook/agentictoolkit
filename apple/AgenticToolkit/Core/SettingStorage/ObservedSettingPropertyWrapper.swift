import Foundation
import Combine

/// A property wrapper that exposes a `UserSetting`'s value and fires a callback
/// with `(oldValue, newValue)` whenever the underlying store changes.
///
/// Intended for non-SwiftUI consumers (managers, controllers) that want to react
/// to setting changes without subscribing to Combine publishers manually. For
/// SwiftUI views, use `@StoredSetting` instead.
///
/// Usage:
/// ```swift
/// @MainActor
/// final class LaunchAtLoginManager {
///     @ObservedSetting(UserSettings.launchAtLogin, onChange: { old, new in
///         print("launchAtLogin: \(old) -> \(new)")
///     })
///     var launchAtLogin: Bool
/// }
/// ```
@propertyWrapper
@MainActor
public final class ObservedSetting<Value: Codable & Sendable> {

    private let setting: UserSetting<Value>
    private let onChange: (_ oldValue: Value, _ newValue: Value) -> Void
    private var cancellable: AnyCancellable?

    public init(
        _ setting: UserSetting<Value>,
        onChange: @escaping (_ oldValue: Value, _ newValue: Value) -> Void
    ) {
        self.setting = setting
        self.onChange = onChange

        var previous = setting.currentValue
        self.cancellable = setting.$currentValue
            .dropFirst()
            .sink { newValue in
                let old = previous
                previous = newValue
                onChange(old, newValue)
            }
    }

    public var wrappedValue: Value {
        get { setting.value }
        set { setting.value = newValue }
    }

    public var projectedValue: UserSetting<Value> { setting }
}

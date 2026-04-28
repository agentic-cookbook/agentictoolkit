import Foundation
import SwiftUI
import Combine

/// A property wrapper that reads and writes a `StoreSettings.Key` value through a `SettingsStorageProvider`,
/// publishing changes for SwiftUI view updates.
///
/// Usage:
/// ```swift
/// struct ContentView: View {
///     @StoredSetting(.userPreferences) var prefs
///
///     var body: some View {
///         Toggle("Notifications", isOn: $prefs.notificationsEnabled)
///     }
/// }
/// ```
///
/// By default the wrapper uses `SettingsEnvironment.shared`, which can be set once at
/// app launch. Pass an explicit `storageProvider:` argument to override it (useful in tests/previews).
@propertyWrapper
@MainActor
public struct StoredSetting<Value: Codable & Sendable>: DynamicProperty {
    @StateObject private var observer: Observer
    private var key: any StorableSetting<Value>

    public init(_ key: any StorableSetting<Value>) {
        self.key = key
        self._observer = StateObject(
            wrappedValue: Observer(key: key)
        )
    }
   
    public var wrappedValue: Value {
        get { observer.value }
        nonmutating set { key.value = newValue }
    }

    public var projectedValue: Binding<Value> {
        Binding(
            get: { observer.value },
            set: { key.value = $0 }
        )
    }
}

extension StoredSetting {
    
    /// Internal observer that bridges a `SettingsStorageProvider` change publisher into SwiftUI's
    /// `ObservableObject` machinery.
    @MainActor
    final class Observer: ObservableObject {
        @Published var value: Value
        private var cancellable: AnyCancellable?
        
        init(key: any StorableSetting<Value>) {
            let store = UserSettings.shared
            self.value = key.value
            self.cancellable = store.changes
                .filter { $0 == key.name }
                .sink { [weak self] _ in
                    guard let self else { return }
                    self.value = UserSettings.shared.get(key)
                }
        }
    }
}


import Foundation
import AgenticToolkitCore

/// `WindowStateStorage` backed by a `SettingsStore`. Lets window frames
/// share the toolkit's general settings persistence — provider
/// pluggability (UserDefaults / iCloud / SQLite), a Combine `changes`
/// publisher, and the same secure-vs-default routing — without
/// `WindowFrameManager` knowing anything about it.
///
/// The on-disk key format (`"WindowState_<id>"`) matches
/// `UserDefaultsWindowStateStorage`'s default, so swapping this in over
/// a UserDefaults-backed `SettingsStore` reads existing state without
/// migration.
@MainActor
public struct SettingsStoreWindowStateStorage: WindowStateStorage {

    private let settings: SettingsStore
    private let keyPrefix: String

    public init(settings: SettingsStore, keyPrefix: String = "WindowState_") {
        self.settings = settings
        self.keyPrefix = keyPrefix
    }

    public func loadState(for id: String) -> PersistedWindowState? {
        settings.get(setting(for: id))
    }

    public func saveState(_ state: PersistedWindowState, for id: String) {
        settings.set(state, for: setting(for: id))
    }

    public func removeState(for id: String) {
        settings.remove(setting(for: id))
    }

    private func setting(for id: String) -> WindowStateSetting {
        WindowStateSetting(name: keyPrefix + id)
    }
}

/// One-key-per-window-id `StorableSetting`. The name is fully resolved
/// at construction time; `SettingsStore` routes via the non-secure
/// provider (matching the original UserDefaults behaviour).
@MainActor
private struct WindowStateSetting: StorableSetting {
    let name: String
    let isSecure: Bool = false
    let defaultValue: PersistedWindowState? = nil
}

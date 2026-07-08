import Foundation
import AgenticToolkitCore

/// Abstracts screen-set persistence so tests can use in-memory storage.
/// Always called from the main actor — `ScreenManager` is the only consumer.
@MainActor
public protocol ScreenSetStorage {
    func loadSets() -> [ScreenSet]
    func saveSets(_ sets: [ScreenSet])
}

/// `ScreenSetStorage` backed by a `SettingsStore`, matching the toolkit's
/// settings-persistence convention (same shape as
/// `SettingsStoreWindowStateStorage`): one Codable blob under a fixed key,
/// routed through the store's non-secure provider.
@MainActor
public struct SettingsStoreScreenSetStorage: ScreenSetStorage {

    private let settings: SettingsStore
    private let setting: ScreenSetsSetting

    public init(settings: SettingsStore, key: String = "ScreenSets") {
        self.settings = settings
        self.setting = ScreenSetsSetting(name: key)
    }

    public func loadSets() -> [ScreenSet] {
        settings.get(setting)
    }

    public func saveSets(_ sets: [ScreenSet]) {
        settings.set(sets, for: setting)
    }
}

/// Single-key `StorableSetting` holding every known screen set.
@MainActor
private struct ScreenSetsSetting: StorableSetting {
    let name: String
    let isSecure: Bool = false
    let defaultValue: [ScreenSet] = []
}

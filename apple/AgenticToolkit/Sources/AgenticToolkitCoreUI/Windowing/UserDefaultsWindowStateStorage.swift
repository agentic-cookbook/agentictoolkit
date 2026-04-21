import Foundation

/// Stores window state in UserDefaults as JSON.
public struct UserDefaultsWindowStateStorage: WindowStateStorage {
    public let keyPrefix: String

    public init(keyPrefix: String = "WindowState_") {
        self.keyPrefix = keyPrefix
    }

    public func loadState(for id: String) -> PersistedWindowState? {
        guard let data = UserDefaults.standard.data(forKey: keyPrefix + id) else { return nil }
        return try? JSONDecoder().decode(PersistedWindowState.self, from: data)
    }

    public func saveState(_ state: PersistedWindowState, for id: String) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: keyPrefix + id)
    }

    public func removeState(for id: String) {
        UserDefaults.standard.removeObject(forKey: keyPrefix + id)
    }
}

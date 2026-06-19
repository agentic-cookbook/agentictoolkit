import Foundation

/// Stores window state in UserDefaults as JSON.
public struct UserDefaultsWindowStateStorage: WindowStateStorage {
    public let keyPrefix: String
    public let visibilityKeyPrefix: String

    public init(
        keyPrefix: String = "WindowState_",
        visibilityKeyPrefix: String = "WindowVisible_"
    ) {
        self.keyPrefix = keyPrefix
        self.visibilityKeyPrefix = visibilityKeyPrefix
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

    public func loadVisibility(for id: String) -> Bool? {
        // `object(forKey:)` distinguishes absent (nil) from explicit false,
        // so a window that's never been shown stays nil rather than
        // misreporting "saved hidden."
        UserDefaults.standard.object(forKey: visibilityKeyPrefix + id) as? Bool
    }

    public func saveVisibility(_ visible: Bool, for id: String) {
        UserDefaults.standard.set(visible, forKey: visibilityKeyPrefix + id)
    }

    public func removeVisibility(for id: String) {
        UserDefaults.standard.removeObject(forKey: visibilityKeyPrefix + id)
    }

    public func visibleWindowIDs() -> [String] {
        UserDefaults.standard.dictionaryRepresentation().compactMap { key, value in
            guard key.hasPrefix(visibilityKeyPrefix), (value as? Bool) == true else { return nil }
            return String(key.dropFirst(visibilityKeyPrefix.count))
        }
    }
}

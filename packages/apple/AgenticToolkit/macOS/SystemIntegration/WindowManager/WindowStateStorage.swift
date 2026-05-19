/// Abstracts persistence so tests can use in-memory storage.
///
/// Always called from the main actor — `WindowFrameManager` is the only
/// consumer and is itself `@MainActor`. Marking the protocol explicitly
/// lets implementations call other main-actor APIs (e.g. `SettingsStore`)
/// without a `MainActor.assumeIsolated` dance.
@MainActor
public protocol WindowStateStorage {
    func loadState(for id: String) -> PersistedWindowState?
    func saveState(_ state: PersistedWindowState, for id: String)
    func removeState(for id: String)

    /// Visibility persistence lives on a separate key so it's independent of
    /// frame persistence — a window may opt in to one and not the other.
    /// Returns nil when nothing has been saved yet.
    func loadVisibility(for id: String) -> Bool?
    func saveVisibility(_ visible: Bool, for id: String)
    func removeVisibility(for id: String)
}

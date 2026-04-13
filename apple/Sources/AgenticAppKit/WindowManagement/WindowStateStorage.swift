/// Abstracts persistence so tests can use in-memory storage.
public protocol WindowStateStorage {
    func loadState(for id: String) -> PersistedWindowState?
    func saveState(_ state: PersistedWindowState, for id: String)
    func removeState(for id: String)
}

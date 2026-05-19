@testable import AgenticToolkitMacOS

/// In-memory storage for testing persistence across simulated relaunches.
class MockStorage: WindowStateStorage {
    var states: [String: PersistedWindowState] = [:]
    var visibility: [String: Bool] = [:]

    func loadState(for id: String) -> PersistedWindowState? {
        states[id]
    }

    func saveState(_ state: PersistedWindowState, for id: String) {
        states[id] = state
    }

    func removeState(for id: String) {
        states[id] = nil
    }

    func loadVisibility(for id: String) -> Bool? {
        visibility[id]
    }

    func saveVisibility(_ visible: Bool, for id: String) {
        visibility[id] = visible
    }

    func removeVisibility(for id: String) {
        visibility[id] = nil
    }
}

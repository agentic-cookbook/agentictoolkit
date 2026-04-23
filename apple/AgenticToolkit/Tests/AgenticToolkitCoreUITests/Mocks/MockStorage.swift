@testable import AgenticToolkitCoreUI

/// In-memory storage for testing persistence across simulated relaunches.
class MockStorage: WindowStateStorage {
    var states: [String: PersistedWindowState] = [:]

    func loadState(for id: String) -> PersistedWindowState? {
        states[id]
    }

    func saveState(_ state: PersistedWindowState, for id: String) {
        states[id] = state
    }

    func removeState(for id: String) {
        states[id] = nil
    }
}

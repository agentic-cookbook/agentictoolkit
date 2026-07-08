@testable import AgenticToolkitMacOS

/// In-memory screen-set storage for ScreenManager tests.
class MockScreenSetStorage: ScreenSetStorage {
    var sets: [ScreenSet] = []
    var saveCount = 0

    func loadSets() -> [ScreenSet] {
        sets
    }

    func saveSets(_ sets: [ScreenSet]) {
        self.sets = sets
        saveCount += 1
    }
}

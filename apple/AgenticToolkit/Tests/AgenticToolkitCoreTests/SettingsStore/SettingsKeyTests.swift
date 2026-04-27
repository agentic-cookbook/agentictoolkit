import XCTest
@testable import AgenticToolkitCore

@MainActor
final class SettingsKeyTests: XCTestCase {
    func testKeyStoresNameAndDefault() {
        let key = UserSetting<Int>("launchCount", default: 0)
        XCTAssertEqual(key.name, "launchCount")
        XCTAssertEqual(key.defaultValue, 0)
    }

    func testKeysWithDifferentValueTypesAreDistinctTypes() {
        let intKey = UserSetting<Int>("count", default: 0)
        let stringKey = UserSetting<String>("count", default: "")
        // Same name string, but the generic parameter makes them different types —
        // and the compiler enforces that at the call site of get/set.
        XCTAssertEqual(intKey.name, stringKey.name)
    }
}

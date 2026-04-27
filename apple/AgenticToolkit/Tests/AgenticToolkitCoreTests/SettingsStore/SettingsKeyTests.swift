import XCTest
@testable import AgenticToolkitCore

final class SettingsKeyTests: XCTestCase {
    func testKeyStoresNameAndDefault() {
        let key = StoredSetting<Int>.Key("launchCount", default: 0)
        XCTAssertEqual(key.name, "launchCount")
        XCTAssertEqual(key.defaultValue, 0)
    }

    func testKeysWithDifferentValueTypesAreDistinctTypes() {
        let intKey = StoredSetting<Int>.Key("count", default: 0)
        let stringKey = StoredSettingKey<String>("count", default: "")
        // Same name string, but the generic parameter makes them different types —
        // and the compiler enforces that at the call site of get/set.
        XCTAssertEqual(intKey.name, stringKey.name)
    }
}

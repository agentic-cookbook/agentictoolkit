import XCTest
@testable import AgenticToolkitMacOS

final class ReopenOnLaunchPolicyTests: XCTestCase {

    func testUseSystemFollowsSystemDefaultTrue() {
        XCTAssertTrue(ReopenOnLaunchPolicy.useSystem.shouldReopen(systemDefault: true))
    }

    func testUseSystemFollowsSystemDefaultFalse() {
        XCTAssertFalse(ReopenOnLaunchPolicy.useSystem.shouldReopen(systemDefault: false))
    }

    func testAlwaysIgnoresSystemDefault() {
        XCTAssertTrue(ReopenOnLaunchPolicy.always.shouldReopen(systemDefault: false))
        XCTAssertTrue(ReopenOnLaunchPolicy.always.shouldReopen(systemDefault: true))
    }

    func testNeverIgnoresSystemDefault() {
        XCTAssertFalse(ReopenOnLaunchPolicy.never.shouldReopen(systemDefault: false))
        XCTAssertFalse(ReopenOnLaunchPolicy.never.shouldReopen(systemDefault: true))
    }

    func testDisplayNamesAreStable() {
        XCTAssertEqual(ReopenOnLaunchPolicy.useSystem.displayName, "Use System Setting")
        XCTAssertEqual(ReopenOnLaunchPolicy.always.displayName, "Always")
        XCTAssertEqual(ReopenOnLaunchPolicy.never.displayName, "Never")
    }

    func testAllCasesHasThreeValues() {
        XCTAssertEqual(ReopenOnLaunchPolicy.allCases.count, 3)
    }
}

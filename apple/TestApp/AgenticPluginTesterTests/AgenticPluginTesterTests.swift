import XCTest
@testable import AgenticPluginTester

final class AgenticPluginTesterTests: XCTestCase {

    func testAppDelegateExists() throws {
        // Verify the AppDelegate class can be instantiated
        let delegate = AppDelegate()
        XCTAssertNotNil(delegate)
    }
}

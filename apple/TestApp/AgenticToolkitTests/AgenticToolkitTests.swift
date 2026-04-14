import XCTest
@testable import AgenticToolkit

final class AgenticToolkitTests: XCTestCase {

    func testAppDelegateExists() throws {
        // Verify the AppDelegate class can be instantiated
        let delegate = AppDelegate()
        XCTAssertNotNil(delegate)
    }
}

import XCTest
@testable import AgenticToolkitApp

@MainActor
final class AgenticToolkitAppTests: XCTestCase {

    @MainActor
    func testAppDelegateExists() throws {
        let delegate = AppDelegate()
        XCTAssertNotNil(delegate)
    }
}

import XCTest
@testable import AgenticToolkitApp

final class AppFeaturesSmokeTests: XCTestCase {

    @MainActor
    func testFeaturesInstantiate() {
        let features = Features()
        XCTAssertNotNil(features.appearanceManager)
        XCTAssertNotNil(features.permissionWalkthrough)
        XCTAssertNotNil(features.terminalCoordinator)
        XCTAssertNotNil(features.aiPluginsCoordinator)
        XCTAssertNotNil(features.aiChatCoordinator)
        XCTAssertNotNil(features.summarizerDebug)
        XCTAssertNotNil(features.sessionWatcherCoordinator)
        XCTAssertNotNil(features.settingsCoordinator)
        XCTAssertNotNil(features.menuManager)
    }
}

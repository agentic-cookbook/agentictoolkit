import AppKit
import XCTest
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@MainActor
final class WindowManagerRecentsTests: XCTestCase {

    private static let limitKey = "NSRecentDocumentsLimit"

    func testApplyRecentDocumentCountFromSettingsWritesUserDefault() {
        let prior = UserSettings.recentWindowsCount.currentValue
        defer { UserSettings.recentWindowsCount.value = prior }

        UserSettings.recentWindowsCount.value = 7
        WindowManager.shared.applyRecentDocumentCountFromSettings()
        XCTAssertEqual(UserDefaults.standard.integer(forKey: Self.limitKey), 7)

        UserSettings.recentWindowsCount.value = 3
        WindowManager.shared.applyRecentDocumentCountFromSettings()
        XCTAssertEqual(UserDefaults.standard.integer(forKey: Self.limitKey), 3)
    }

    func testSettingChangePropagatesViaCombineSink() {
        let prior = UserSettings.recentWindowsCount.currentValue
        defer { UserSettings.recentWindowsCount.value = prior }

        // Touch shared so the manager's sink is wired and observing.
        _ = WindowManager.shared

        UserSettings.recentWindowsCount.value = 12
        let expectation = expectation(description: "user default updated")
        DispatchQueue.main.async {
            XCTAssertEqual(UserDefaults.standard.integer(forKey: Self.limitKey), 12)
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 1.0)
    }
}

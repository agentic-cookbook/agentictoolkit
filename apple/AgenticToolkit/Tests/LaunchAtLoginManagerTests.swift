import XCTest
import ServiceManagement
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

/// Mock implementation of LaunchAtLoginServiceProtocol for unit testing.
final class MockLaunchAtLoginService: LaunchAtLoginServiceProtocol {
    var status: SMAppService.Status = .notRegistered
    var registerCallCount = 0
    var unregisterCallCount = 0
    var shouldThrowOnRegister = false
    var shouldThrowOnUnregister = false

    func register() throws {
        registerCallCount += 1
        if shouldThrowOnRegister {
            throw NSError(domain: "TestError", code: 1, userInfo: [NSLocalizedDescriptionKey: "Mock register error"])
        }
        status = .enabled
    }

    func unregister() throws {
        unregisterCallCount += 1
        if shouldThrowOnUnregister {
            throw NSError(domain: "TestError", code: 2, userInfo: [NSLocalizedDescriptionKey: "Mock unregister error"])
        }
        status = .notRegistered
    }
}

@MainActor
final class LaunchAtLoginManagerTests: XCTestCase {

    private var settingsStore: SettingsStore!
    private var SessionWatcherDatabaseManager: SessionWatcherDatabaseManager!
    private var tempDBPath: String!
    private var mockService: MockLaunchAtLoginService!

    override func setUp() async throws {
        try await super.setUp()
        settingsStore = SettingsStore(
            with: InMemorySettingsStorageProvider(),
            secureSettingsProvider: InMemorySecureSettingsStorageProvider()
        )
        // SettingsViewModel still owns a DB-backed settings table; the integration
        // tests below construct one against a temp path. LaunchAtLoginManager itself
        // only consults `settingsStore`.
        let tempDir = NSTemporaryDirectory()
        tempDBPath = (tempDir as NSString).appendingPathComponent("whippet_launch_test_\(UUID().uuidString).db")
        SessionWatcherDatabaseManager = try AgenticToolkitMacOS.SessionWatcherDatabaseManager(path: tempDBPath)
        mockService = MockLaunchAtLoginService()
    }

    override func tearDown() async throws {
        SessionWatcherDatabaseManager?.close()
        if let tempDBPath { try? FileManager.default.removeItem(atPath: tempDBPath) }
        settingsStore = nil
        SessionWatcherDatabaseManager = nil
        tempDBPath = nil
        mockService = nil
        try await super.tearDown()
    }

    // MARK: - isEnabled

    func testIsEnabledReflectsServiceStatus() throws {
        let manager = LaunchAtLoginManager(service: mockService)

        mockService.status = .notRegistered
        XCTAssertFalse(manager.isEnabled)

        mockService.status = .enabled
        XCTAssertTrue(manager.isEnabled)

        mockService.status = .requiresApproval
        XCTAssertFalse(manager.isEnabled)
    }

    // MARK: - setEnabled

    func testSetEnabledTrueCallsRegister() throws {
        let manager = LaunchAtLoginManager(service: mockService)

        try manager.setEnabled(true)

        XCTAssertEqual(mockService.registerCallCount, 1)
        XCTAssertEqual(mockService.unregisterCallCount, 0)
        XCTAssertTrue(manager.isEnabled)
    }

    func testSetEnabledFalseCallsUnregister() throws {
        let manager = LaunchAtLoginManager(service: mockService)
        mockService.status = .enabled

        try manager.setEnabled(false)

        XCTAssertEqual(mockService.unregisterCallCount, 1)
        XCTAssertEqual(mockService.registerCallCount, 0)
        XCTAssertFalse(manager.isEnabled)
    }

    func testSetEnabledPersistsToDatabase() throws {
        let manager = LaunchAtLoginManager(service: mockService)

        try manager.setEnabled(true)
        let value = String(describing: settingsStore.get(UserSettings.launchAtLogin))
        XCTAssertEqual(value, "true")

        try manager.setEnabled(false)
        let value2 = String(describing: settingsStore.get(UserSettings.launchAtLogin))
        XCTAssertEqual(value2, "false")
    }

    func testSetEnabledThrowsOnRegisterFailure() throws {
        let manager = LaunchAtLoginManager(service: mockService)
        mockService.shouldThrowOnRegister = true

        XCTAssertThrowsError(try manager.setEnabled(true))
        XCTAssertFalse(manager.isEnabled)
    }

    func testSetEnabledThrowsOnUnregisterFailure() throws {
        let manager = LaunchAtLoginManager(service: mockService)
        mockService.status = .enabled
        mockService.shouldThrowOnUnregister = true

        XCTAssertThrowsError(try manager.setEnabled(false))
        // Status should remain enabled since unregister failed
        XCTAssertTrue(manager.isEnabled)
    }

    // MARK: - Prompt State

    func testHasShownPromptDefaultsToFalse() throws {
        let manager = LaunchAtLoginManager(service: mockService)

        XCTAssertFalse(manager.hasShownPrompt)
    }

    func testMarkPromptShownPersists() throws {
        let manager = LaunchAtLoginManager(service: mockService)

        manager.markPromptShown()

        XCTAssertTrue(manager.hasShownPrompt)

        // Verify it persisted to the database
        let value = String(describing: settingsStore.get(UserSettings.launchAtLoginPromptShown))
        XCTAssertEqual(value, "true")
    }

    func testHasShownPromptReadsFromDatabase() throws {
        settingsStore.set(true, for: UserSettings.launchAtLoginPromptShown)

        let manager = LaunchAtLoginManager(service: mockService)

        XCTAssertTrue(manager.hasShownPrompt)
    }

   
}

import XCTest
import AgenticToolkitCoreMacOS
import ServiceManagement
@testable import AgenticToolkitApp

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

    private var sessionsDatabaseManager: SessionsDatabaseManager!
    private var tempDBPath: String!
    private var mockService: MockLaunchAtLoginService!

    override func setUpWithError() throws {
        try super.setUpWithError()
        let tempDir = NSTemporaryDirectory()
        tempDBPath = (tempDir as NSString).appendingPathComponent("agentic_launch_test_\(UUID().uuidString).db")
        sessionsDatabaseManager = try SessionsDatabaseManager(path: tempDBPath)
        mockService = MockLaunchAtLoginService()
    }

    override func tearDownWithError() throws {
        sessionsDatabaseManager.close()
        try? FileManager.default.removeItem(atPath: tempDBPath)
        try super.tearDownWithError()
    }

    // MARK: - isEnabled

    func testIsEnabledReflectsServiceStatus() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)

        mockService.status = .notRegistered
        XCTAssertFalse(manager.isEnabled)

        mockService.status = .enabled
        XCTAssertTrue(manager.isEnabled)

        mockService.status = .requiresApproval
        XCTAssertFalse(manager.isEnabled)
    }

    // MARK: - setEnabled

    func testSetEnabledTrueCallsRegister() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)

        try manager.setEnabled(true)

        XCTAssertEqual(mockService.registerCallCount, 1)
        XCTAssertEqual(mockService.unregisterCallCount, 0)
        XCTAssertTrue(manager.isEnabled)
    }

    func testSetEnabledFalseCallsUnregister() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        mockService.status = .enabled

        try manager.setEnabled(false)

        XCTAssertEqual(mockService.unregisterCallCount, 1)
        XCTAssertEqual(mockService.registerCallCount, 0)
        XCTAssertFalse(manager.isEnabled)
    }

    func testSetEnabledPersistsToDatabase() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)

        try manager.setEnabled(true)
        let value = try sessionsDatabaseManager.getSetting(key: LaunchAtLoginManager.launchAtLoginKey)
        XCTAssertEqual(value, "true")

        try manager.setEnabled(false)
        let value2 = try sessionsDatabaseManager.getSetting(key: LaunchAtLoginManager.launchAtLoginKey)
        XCTAssertEqual(value2, "false")
    }

    func testSetEnabledThrowsOnRegisterFailure() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        mockService.shouldThrowOnRegister = true

        XCTAssertThrowsError(try manager.setEnabled(true))
        XCTAssertFalse(manager.isEnabled)
    }

    func testSetEnabledThrowsOnUnregisterFailure() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        mockService.status = .enabled
        mockService.shouldThrowOnUnregister = true

        XCTAssertThrowsError(try manager.setEnabled(false))
        // Status should remain enabled since unregister failed
        XCTAssertTrue(manager.isEnabled)
    }

    // MARK: - Prompt State

    func testHasShownPromptDefaultsToFalse() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)

        XCTAssertFalse(manager.hasShownPrompt)
    }

    func testMarkPromptShownPersists() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)

        manager.markPromptShown()

        XCTAssertTrue(manager.hasShownPrompt)

        // Verify it persisted to the database
        let value = try sessionsDatabaseManager.getSetting(key: LaunchAtLoginManager.launchAtLoginPromptShownKey)
        XCTAssertEqual(value, "true")
    }

    func testHasShownPromptReadsFromDatabase() throws {
        try sessionsDatabaseManager.setSetting(key: LaunchAtLoginManager.launchAtLoginPromptShownKey, value: "true")

        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)

        XCTAssertTrue(manager.hasShownPrompt)
    }

    // MARK: - SettingsViewModel Integration

    func testSettingsViewModelLaunchAtLoginToggle() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        let viewModel = SettingsViewModel(
            sessionsDatabaseManager: sessionsDatabaseManager,
            pluginManager: AIPluginManager(searchPaths: []),
            launchAtLoginManager: manager
        )

        XCTAssertFalse(viewModel.launchAtLogin)

        viewModel.launchAtLogin = true
        XCTAssertTrue(manager.isEnabled)
        XCTAssertEqual(mockService.registerCallCount, 1)

        viewModel.launchAtLogin = false
        XCTAssertFalse(manager.isEnabled)
        XCTAssertEqual(mockService.unregisterCallCount, 1)
    }

    func testSettingsViewModelReflectsActualState() throws {
        mockService.status = .enabled
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        let viewModel = SettingsViewModel(
            sessionsDatabaseManager: sessionsDatabaseManager,
            pluginManager: AIPluginManager(searchPaths: []),
            launchAtLoginManager: manager
        )

        XCTAssertTrue(viewModel.launchAtLogin)
    }

    func testSettingsViewModelShowsPromptOnFirstLaunch() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        let viewModel = SettingsViewModel(
            sessionsDatabaseManager: sessionsDatabaseManager,
            pluginManager: AIPluginManager(searchPaths: []),
            launchAtLoginManager: manager
        )

        XCTAssertTrue(viewModel.shouldShowLaunchAtLoginPrompt)
    }

    func testSettingsViewModelHidesPromptAfterDismissal() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        let viewModel = SettingsViewModel(
            sessionsDatabaseManager: sessionsDatabaseManager,
            pluginManager: AIPluginManager(searchPaths: []),
            launchAtLoginManager: manager
        )

        viewModel.dismissLaunchAtLoginPrompt()

        XCTAssertFalse(viewModel.shouldShowLaunchAtLoginPrompt)
        XCTAssertTrue(manager.hasShownPrompt)
    }

    func testSettingsViewModelHidesPromptIfAlreadyShown() throws {
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        manager.markPromptShown()

        let viewModel = SettingsViewModel(
            sessionsDatabaseManager: sessionsDatabaseManager,
            pluginManager: AIPluginManager(searchPaths: []),
            launchAtLoginManager: manager
        )

        XCTAssertFalse(viewModel.shouldShowLaunchAtLoginPrompt)
    }

    func testSettingsViewModelRevertsOnRegisterFailure() throws {
        mockService.shouldThrowOnRegister = true
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        let viewModel = SettingsViewModel(
            sessionsDatabaseManager: sessionsDatabaseManager,
            pluginManager: AIPluginManager(searchPaths: []),
            launchAtLoginManager: manager
        )

        viewModel.launchAtLogin = true

        // Should revert to false because register threw
        XCTAssertFalse(viewModel.launchAtLogin)
    }

    func testConfigureLaunchAtLoginSyncsState() throws {
        mockService.status = .enabled
        let manager = LaunchAtLoginManager(sessionsDatabaseManager: sessionsDatabaseManager, service: mockService)
        let viewModel = SettingsViewModel(
            sessionsDatabaseManager: sessionsDatabaseManager,
            pluginManager: AIPluginManager(searchPaths: [])
        )

        XCTAssertFalse(viewModel.launchAtLogin)

        viewModel.configureLaunchAtLogin(manager)

        XCTAssertTrue(viewModel.launchAtLogin)
    }

    func testSettingsKeysMatch() throws {
        XCTAssertEqual(SettingsViewModel.launchAtLoginKey, LaunchAtLoginManager.launchAtLoginKey)
        XCTAssertEqual(SettingsViewModel.launchAtLoginPromptShownKey, LaunchAtLoginManager.launchAtLoginPromptShownKey)
    }
}

import XCTest
import AgenticToolkitAIPlugins
@testable import AgenticToolkitApp

@MainActor
final class SettingsViewModelTests: XCTestCase {

    private var databaseManager: DatabaseManager!
    private var tempDBPath: String!

    override func setUpWithError() throws {
        try super.setUpWithError()
        let tempDir = NSTemporaryDirectory()
        tempDBPath = (tempDir as NSString).appendingPathComponent("agentic_settings_test_\(UUID().uuidString).db")
        databaseManager = try DatabaseManager(path: tempDBPath)
    }

    private func makeViewModel() -> SettingsViewModel {
        SettingsViewModel(
            databaseManager: databaseManager,
            pluginManager: AIPluginManager(searchPaths: [])
        )
    }
    override func tearDownWithError() throws {
        databaseManager.close()
        try? FileManager.default.removeItem(atPath: tempDBPath)
        try super.tearDownWithError()
    }

    // MARK: - Default Values

    func testDefaultValuesWhenDatabaseEmpty() throws {
        let viewModel = makeViewModel()

        XCTAssertEqual(viewModel.stalenessTimeout, SettingsViewModel.defaultStalenessTimeout)
        XCTAssertEqual(viewModel.alwaysOnTop, SettingsViewModel.defaultAlwaysOnTop)
        XCTAssertEqual(viewModel.transparency, SettingsViewModel.defaultTransparency)
        XCTAssertEqual(viewModel.notifySessionStart, SettingsViewModel.defaultNotifySessionStart)
        XCTAssertEqual(viewModel.notifySessionEnd, SettingsViewModel.defaultNotifySessionEnd)
        XCTAssertEqual(viewModel.notifyStale, SettingsViewModel.defaultNotifyStale)
        XCTAssertEqual(viewModel.clickAction, SettingsViewModel.defaultClickAction)
        XCTAssertEqual(viewModel.customCommand, SettingsViewModel.defaultCustomCommand)
    }

    // MARK: - Staleness Timeout

    func testStalenessTimeoutPersists() throws {
        let viewModel = makeViewModel()
        viewModel.stalenessTimeout = 120

        let value = try databaseManager.getSetting(key: SettingsViewModel.stalenessTimeoutKey)
        XCTAssertEqual(value, "120")
    }

    func testStalenessTimeoutLoadsFromDatabase() throws {
        try databaseManager.setSetting(key: SettingsViewModel.stalenessTimeoutKey, value: "300")
        let viewModel = makeViewModel()

        XCTAssertEqual(viewModel.stalenessTimeout, 300)
    }

    func testStalenessTimeoutDisplay() throws {
        let viewModel = makeViewModel()

        viewModel.stalenessTimeout = 30
        XCTAssertEqual(viewModel.stalenessTimeoutDisplay, "30 seconds")

        viewModel.stalenessTimeout = 60
        XCTAssertEqual(viewModel.stalenessTimeoutDisplay, "1 minute")

        viewModel.stalenessTimeout = 120
        XCTAssertEqual(viewModel.stalenessTimeoutDisplay, "2 minutes")

        viewModel.stalenessTimeout = 90
        XCTAssertEqual(viewModel.stalenessTimeoutDisplay, "1m 30s")

        viewModel.stalenessTimeout = 1
        // Since slider minimum is 30 but we can set programmatically
        XCTAssertEqual(viewModel.stalenessTimeoutDisplay, "1 second")
    }

    // MARK: - Always On Top

    func testAlwaysOnTopPersists() throws {
        let viewModel = makeViewModel()
        viewModel.alwaysOnTop = false

        let value = try databaseManager.getSetting(key: SettingsViewModel.alwaysOnTopKey)
        XCTAssertEqual(value, "false")
    }

    func testAlwaysOnTopLoadsFromDatabase() throws {
        try databaseManager.setSetting(key: SettingsViewModel.alwaysOnTopKey, value: "false")
        let viewModel = makeViewModel()

        XCTAssertEqual(viewModel.alwaysOnTop, false)
    }

    func testAlwaysOnTopCallbackFires() throws {
        let viewModel = makeViewModel()
        var callbackValue: Bool?
        viewModel.onAlwaysOnTopChanged = { value in
            callbackValue = value
        }

        viewModel.alwaysOnTop = false
        XCTAssertEqual(callbackValue, false)

        viewModel.alwaysOnTop = true
        XCTAssertEqual(callbackValue, true)
    }

    // MARK: - Transparency

    func testTransparencyPersists() throws {
        let viewModel = makeViewModel()
        viewModel.transparency = 0.75

        let value = try databaseManager.getSetting(key: SettingsViewModel.transparencyKey)
        XCTAssertEqual(value, "0.75")
    }

    func testTransparencyLoadsFromDatabase() throws {
        try databaseManager.setSetting(key: SettingsViewModel.transparencyKey, value: "0.80")
        let viewModel = makeViewModel()

        XCTAssertEqual(viewModel.transparency, 0.80, accuracy: 0.01)
    }

    func testTransparencyClampedToMinimum() throws {
        let viewModel = makeViewModel()
        viewModel.transparency = 0.1

        XCTAssertEqual(viewModel.transparency, 0.3, accuracy: 0.01)
    }

    func testTransparencyClampedToMaximum() throws {
        let viewModel = makeViewModel()
        viewModel.transparency = 1.5

        XCTAssertEqual(viewModel.transparency, 1.0, accuracy: 0.01)
    }

    func testTransparencyCallbackFires() throws {
        let viewModel = makeViewModel()
        var callbackValue: CGFloat?
        viewModel.onTransparencyChanged = { value in
            callbackValue = value
        }

        viewModel.transparency = 0.75
        XCTAssertNotNil(callbackValue)
        XCTAssertEqual(Double(callbackValue!), 0.75, accuracy: 0.01)
    }

    // MARK: - Notification Toggles

    func testNotifySessionStartPersists() throws {
        let viewModel = makeViewModel()
        viewModel.notifySessionStart = true

        let value = try databaseManager.getSetting(key: SettingsViewModel.notifySessionStartKey)
        XCTAssertEqual(value, "true")
    }

    func testNotifySessionEndPersists() throws {
        let viewModel = makeViewModel()
        viewModel.notifySessionEnd = true

        let value = try databaseManager.getSetting(key: SettingsViewModel.notifySessionEndKey)
        XCTAssertEqual(value, "true")
    }

    func testNotifyStalePersists() throws {
        let viewModel = makeViewModel()
        viewModel.notifyStale = true

        let value = try databaseManager.getSetting(key: SettingsViewModel.notifyStaleKey)
        XCTAssertEqual(value, "true")
    }

    func testNotificationTogglesLoadFromDatabase() throws {
        try databaseManager.setSetting(key: SettingsViewModel.notifySessionStartKey, value: "true")
        try databaseManager.setSetting(key: SettingsViewModel.notifySessionEndKey, value: "true")
        try databaseManager.setSetting(key: SettingsViewModel.notifyStaleKey, value: "true")

        let viewModel = makeViewModel()

        XCTAssertTrue(viewModel.notifySessionStart)
        XCTAssertTrue(viewModel.notifySessionEnd)
        XCTAssertTrue(viewModel.notifyStale)
    }

    // MARK: - Click Action

    func testClickActionPersists() throws {
        let viewModel = makeViewModel()
        viewModel.clickAction = .copySessionId

        let value = try databaseManager.getSetting(key: SettingsViewModel.clickActionKey)
        XCTAssertEqual(value, SessionClickAction.copySessionId.rawValue)
    }

    func testClickActionLoadsFromDatabase() throws {
        try databaseManager.setSetting(
            key: SettingsViewModel.clickActionKey,
            value: SessionClickAction.openTranscript.rawValue
        )
        let viewModel = makeViewModel()

        XCTAssertEqual(viewModel.clickAction, .openTranscript)
    }

    func testAllClickActionsCanBeSelected() throws {
        let viewModel = makeViewModel()

        for action in SessionClickAction.allCases {
            viewModel.clickAction = action
            let value = try databaseManager.getSetting(key: SettingsViewModel.clickActionKey)
            XCTAssertEqual(value, action.rawValue, "Failed to persist action: \(action)")
        }
    }

    // MARK: - Custom Command

    func testCustomCommandPersists() throws {
        let viewModel = makeViewModel()
        viewModel.customCommand = "open -a 'Visual Studio Code' $CWD"

        let value = try databaseManager.getSetting(key: SettingsViewModel.customCommandKey)
        XCTAssertEqual(value, "open -a 'Visual Studio Code' $CWD")
    }

    func testCustomCommandLoadsFromDatabase() throws {
        try databaseManager.setSetting(key: SettingsViewModel.customCommandKey, value: "code $CWD")
        let viewModel = makeViewModel()

        XCTAssertEqual(viewModel.customCommand, "code $CWD")
    }

    // MARK: - Settings Shared With Other Components

    func testStalenessTimeoutSharedWithLivenessMonitor() throws {
        // Verify that SettingsViewModel uses the same key as SessionLivenessMonitor
        XCTAssertEqual(SettingsViewModel.stalenessTimeoutKey, SessionLivenessMonitor.stalenessTimeoutKey)

        // Set via view model, read via liveness monitor's mechanism
        let viewModel = makeViewModel()
        viewModel.stalenessTimeout = 180

        let monitor = SessionLivenessMonitor(databaseManager: databaseManager)
        XCTAssertEqual(monitor.currentTimeout(), 180)
    }

    func testClickActionSharedWithActionHandler() throws {
        // Verify that SettingsViewModel uses the same key as SessionActionHandler
        XCTAssertEqual(SettingsViewModel.clickActionKey, SessionActionHandler.clickActionKey)

        // Set via view model, read via action handler
        let viewModel = makeViewModel()
        viewModel.clickAction = .copySessionId

        let handler = SessionActionHandler(databaseManager: databaseManager)
        XCTAssertEqual(handler.currentAction, .copySessionId)
    }

    func testCustomCommandSharedWithActionHandler() throws {
        XCTAssertEqual(SettingsViewModel.customCommandKey, SessionActionHandler.customCommandKey)

        let viewModel = makeViewModel()
        viewModel.customCommand = "my-script $SESSION_ID"

        let handler = SessionActionHandler(databaseManager: databaseManager)
        XCTAssertEqual(handler.customCommandTemplate, "my-script $SESSION_ID")
    }

    // MARK: - Load From Database Overwrites Defaults

    func testLoadFromDatabaseOverwritesAllDefaults() throws {
        try databaseManager.setSetting(key: SettingsViewModel.stalenessTimeoutKey, value: "200")
        try databaseManager.setSetting(key: SettingsViewModel.alwaysOnTopKey, value: "false")
        try databaseManager.setSetting(key: SettingsViewModel.transparencyKey, value: "0.50")
        try databaseManager.setSetting(key: SettingsViewModel.notifySessionStartKey, value: "true")
        try databaseManager.setSetting(key: SettingsViewModel.notifySessionEndKey, value: "true")
        try databaseManager.setSetting(key: SettingsViewModel.notifyStaleKey, value: "true")
        try databaseManager.setSetting(key: SettingsViewModel.clickActionKey, value: "copy_session_id")
        try databaseManager.setSetting(key: SettingsViewModel.customCommandKey, value: "my-cmd")

        let viewModel = makeViewModel()

        XCTAssertEqual(viewModel.stalenessTimeout, 200)
        XCTAssertEqual(viewModel.alwaysOnTop, false)
        XCTAssertEqual(viewModel.transparency, 0.50, accuracy: 0.01)
        XCTAssertTrue(viewModel.notifySessionStart)
        XCTAssertTrue(viewModel.notifySessionEnd)
        XCTAssertTrue(viewModel.notifyStale)
        XCTAssertEqual(viewModel.clickAction, .copySessionId)
        XCTAssertEqual(viewModel.customCommand, "my-cmd")
    }
}

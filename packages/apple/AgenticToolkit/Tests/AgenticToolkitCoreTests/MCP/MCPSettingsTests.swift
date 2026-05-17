import XCTest
@testable import AgenticToolkitCore

@MainActor
final class MCPSettingsTests: XCTestCase {

    var regular: InMemorySettingsStorageProvider!
    var secure: InMemorySecureSettingsStorageProvider!
    var store: SettingsStore!

    override func setUp() async throws {
        try await super.setUp()
        regular = InMemorySettingsStorageProvider()
        secure = InMemorySecureSettingsStorageProvider()
        store = SettingsStore(with: regular, secureSettingsProvider: secure)
    }

    override func tearDown() async throws {
        store = nil
        regular = nil
        secure = nil
        try await super.tearDown()
    }

    // MARK: - Defaults

    func testConfigurationsDefaultsToEmpty() {
        XCTAssertEqual(store.get(UserSettings.mcpServerConfigurations), [])
    }

    func testSecretsDefaultsToEmpty() {
        XCTAssertEqual(store.get(UserSettings.mcpServerSecrets), [:])
    }

    // MARK: - Round-trip

    func testStoresConfigurationsThroughStore() {
        let configs = [
            MCPServerConfiguration(
                name: "fs",
                transport: .stdio(command: "fs-mcp", arguments: [], environment: [:])
            )
        ]
        store.set(configs, for: UserSettings.mcpServerConfigurations)
        XCTAssertEqual(store.get(UserSettings.mcpServerConfigurations), configs)
    }

    func testStoresSecretsThroughStore() {
        let id = UUID().uuidString
        let secrets: MCPServerSecrets = [id: ["GITHUB_TOKEN": "ghp_test"]]
        store.set(secrets, for: UserSettings.mcpServerSecrets)
        XCTAssertEqual(store.get(UserSettings.mcpServerSecrets), secrets)
    }

    // MARK: - Routing — the load-bearing assertion

    func testConfigurationsRouteToRegularProvider() {
        let configs = [
            MCPServerConfiguration(
                name: "fs",
                transport: .stdio(command: "fs-mcp", arguments: [], environment: [:])
            )
        ]
        store.set(configs, for: UserSettings.mcpServerConfigurations)

        XCTAssertTrue(regular.contains(UserSettings.mcpServerConfigurations))
        XCTAssertFalse(secure.contains(UserSettings.mcpServerConfigurations))
    }

    func testSecretsRouteToSecureProvider() {
        let secrets: MCPServerSecrets = [
            UUID().uuidString: ["GITHUB_TOKEN": "ghp_test"]
        ]
        store.set(secrets, for: UserSettings.mcpServerSecrets)

        XCTAssertTrue(secure.contains(UserSettings.mcpServerSecrets))
        XCTAssertFalse(regular.contains(UserSettings.mcpServerSecrets))
    }

    func testKeysAreFlaggedCorrectly() {
        XCTAssertFalse(UserSettings.mcpServerConfigurations.isSecure)
        XCTAssertTrue(UserSettings.mcpServerSecrets.isSecure)
    }
}

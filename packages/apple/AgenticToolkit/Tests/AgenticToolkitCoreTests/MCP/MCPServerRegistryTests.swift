import XCTest
import Combine
import MCP
@testable import AgenticToolkitCore

@MainActor
final class MCPServerRegistryTests: XCTestCase {

    var regular: InMemorySettingsStorageProvider!
    var secure: InMemorySecureSettingsStorageProvider!
    var store: SettingsStore!
    var fakeFactory: FakeClientFactory!

    override func setUp() async throws {
        try await super.setUp()
        regular = InMemorySettingsStorageProvider()
        secure = InMemorySecureSettingsStorageProvider()
        store = SettingsStore(with: regular, secureSettingsProvider: secure)
        fakeFactory = FakeClientFactory()
    }

    override func tearDown() async throws {
        regular = nil
        secure = nil
        store = nil
        fakeFactory = nil
        try await super.tearDown()
    }

    // MARK: - Reconciliation

    func testStartsEmpty() {
        let registry = MCPServerRegistry(store: store, clientFactory: fakeFactory.make)
        XCTAssertTrue(registry.clients.isEmpty)
    }

    func testCreatesClientForEnabledConfiguration() async throws {
        let registry = MCPServerRegistry(store: store, clientFactory: fakeFactory.make)
        let config = MCPServerConfiguration(
            name: "fs",
            transport: .stdio(command: "fs-mcp", arguments: [], environment: [:])
        )
        store.set([config], for: UserSettings.mcpServerConfigurations)

        XCTAssertEqual(registry.clients.count, 1)
        XCTAssertNotNil(registry.client(for: config.id))
        try await waitForConnect(fakeFactory)
        XCTAssertEqual(fakeFactory.connectCalls, 1)
    }

    func testIgnoresDisabledConfiguration() {
        let registry = MCPServerRegistry(store: store, clientFactory: fakeFactory.make)
        let disabled = MCPServerConfiguration(
            name: "fs",
            transport: .stdio(command: "fs-mcp", arguments: [], environment: [:]),
            isEnabled: false
        )
        store.set([disabled], for: UserSettings.mcpServerConfigurations)
        XCTAssertTrue(registry.clients.isEmpty)
    }

    func testDisablingConfigurationRemovesClient() async throws {
        let registry = MCPServerRegistry(store: store, clientFactory: fakeFactory.make)
        var config = MCPServerConfiguration(
            name: "fs",
            transport: .stdio(command: "fs-mcp", arguments: [], environment: [:])
        )
        store.set([config], for: UserSettings.mcpServerConfigurations)
        XCTAssertEqual(registry.clients.count, 1)

        config.isEnabled = false
        store.set([config], for: UserSettings.mcpServerConfigurations)

        XCTAssertTrue(registry.clients.isEmpty)
        try await waitForDisconnect(fakeFactory)
        XCTAssertEqual(fakeFactory.disconnectCalls, 1)
    }

    func testRemovingConfigurationDisconnectsClient() async throws {
        let registry = MCPServerRegistry(store: store, clientFactory: fakeFactory.make)
        let config = MCPServerConfiguration(
            name: "fs",
            transport: .stdio(command: "fs-mcp", arguments: [], environment: [:])
        )
        store.set([config], for: UserSettings.mcpServerConfigurations)

        store.set([], for: UserSettings.mcpServerConfigurations)

        XCTAssertTrue(registry.clients.isEmpty)
        try await waitForDisconnect(fakeFactory)
    }

    func testPassesSecretsToFactory() {
        let registry = MCPServerRegistry(store: store, clientFactory: fakeFactory.make)
        let config = MCPServerConfiguration(
            name: "github",
            transport: .stdio(command: "gh-mcp", arguments: [], environment: [:])
        )
        let secrets: MCPServerSecrets = [config.id.uuidString: ["GITHUB_TOKEN": "ghp_test"]]
        store.set(secrets, for: UserSettings.mcpServerSecrets)
        store.set([config], for: UserSettings.mcpServerConfigurations)

        XCTAssertEqual(fakeFactory.lastSecrets, ["GITHUB_TOKEN": "ghp_test"])
        _ = registry  // keep alive
    }

    // MARK: - tools(forIds:)

    func testToolsCollectsFromMatchingClients() async {
        let registry = MCPServerRegistry(store: store, clientFactory: fakeFactory.make)
        let configA = MCPServerConfiguration(
            name: "a",
            transport: .stdio(command: "a", arguments: [], environment: [:])
        )
        let configB = MCPServerConfiguration(
            name: "b",
            transport: .stdio(command: "b", arguments: [], environment: [:])
        )
        store.set([configA, configB], for: UserSettings.mcpServerConfigurations)

        let toolA = MCP.Tool(name: "tool_a", description: nil, inputSchema: .object([:]))
        let toolB = MCP.Tool(name: "tool_b", description: nil, inputSchema: .object([:]))
        if let clientA = registry.client(for: configA.id) as? FakeMCPClient {
            await clientA.setCachedTools([toolA])
        }
        if let clientB = registry.client(for: configB.id) as? FakeMCPClient {
            await clientB.setCachedTools([toolB])
        }

        let pairs = await registry.tools(forIds: [configA.id, configB.id])
        let names = Set(pairs.map { $0.1.name })
        XCTAssertEqual(names, ["tool_a", "tool_b"])

        let onlyA = await registry.tools(forIds: [configA.id])
        XCTAssertEqual(onlyA.map { $0.1.name }, ["tool_a"])
    }

    // MARK: - Helpers

    /// Spin briefly while the connect Task drains so the test can assert
    /// against the recorded call counts.
    private func waitForConnect(_ factory: FakeClientFactory, timeout: TimeInterval = 1.0) async throws {
        let deadline = Date().addingTimeInterval(timeout)
        while factory.connectCalls == 0 && Date() < deadline {
            try await Task.sleep(nanoseconds: 5_000_000)
        }
    }

    private func waitForDisconnect(_ factory: FakeClientFactory, timeout: TimeInterval = 1.0) async throws {
        let deadline = Date().addingTimeInterval(timeout)
        while factory.disconnectCalls == 0 && Date() < deadline {
            try await Task.sleep(nanoseconds: 5_000_000)
        }
    }
}

// MARK: - Test doubles

@MainActor
final class FakeClientFactory {
    private(set) var made: [FakeMCPClient] = []
    private(set) var lastSecrets: [String: String] = [:]
    var connectCalls: Int { made.reduce(0) { $0 + $1.unsafeConnectCalls } }
    var disconnectCalls: Int { made.reduce(0) { $0 + $1.unsafeDisconnectCalls } }

    func make(_ configuration: MCPServerConfiguration, _ secrets: [String: String]) -> any MCPClientProtocol {
        lastSecrets = secrets
        let client = FakeMCPClient(id: configuration.id, name: configuration.name)
        made.append(client)
        return client
    }
}

actor FakeMCPClient: MCPClientProtocol {
    nonisolated let id: UUID
    nonisolated let name: String
    var state: MCPClientState = .disconnected
    var cachedTools: [MCP.Tool] = []

    /// Read-only snapshots that drive the test assertions. Marked unsafe
    /// because they're read from the test's main-actor context; mutation
    /// happens only inside the actor.
    nonisolated(unsafe) var unsafeConnectCalls: Int = 0
    nonisolated(unsafe) var unsafeDisconnectCalls: Int = 0

    init(id: UUID, name: String) {
        self.id = id
        self.name = name
    }

    func connect() async throws {
        unsafeConnectCalls += 1
        state = .connected
    }

    func disconnect() async {
        unsafeDisconnectCalls += 1
        state = .disconnected
    }

    func refreshTools() async throws {}

    func callTool(
        name: String,
        arguments: [String: Value]?
    ) async throws -> (content: [MCP.Tool.Content], isError: Bool) {
        ([], false)
    }

    func setCachedTools(_ tools: [MCP.Tool]) {
        cachedTools = tools
    }
}

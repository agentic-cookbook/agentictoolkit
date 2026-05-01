import XCTest
@testable import AgenticToolkitCore

final class MCPServerConfigurationTests: XCTestCase {

    // MARK: - Codable round-trip

    func testStdioRoundTrip() throws {
        let original = MCPServerConfiguration(
            id: UUID(),
            name: "filesystem",
            transport: .stdio(
                command: "npx",
                arguments: ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
                environment: ["RUST_LOG": "info"]
            ),
            isEnabled: true
        )

        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(MCPServerConfiguration.self, from: data)

        XCTAssertEqual(decoded, original)
    }

    func testHttpRoundTrip() throws {
        let endpoint = URL(string: "https://example.com/mcp")!
        let original = MCPServerConfiguration(
            name: "remote",
            transport: .http(endpoint: endpoint, streaming: true),
            isEnabled: false
        )

        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(MCPServerConfiguration.self, from: data)

        XCTAssertEqual(decoded, original)
        XCTAssertEqual(decoded.transport, .http(endpoint: endpoint, streaming: true))
    }

    func testArrayRoundTrip() throws {
        let configs: [MCPServerConfiguration] = [
            MCPServerConfiguration(
                name: "fs",
                transport: .stdio(command: "fs-mcp", arguments: [], environment: [:])
            ),
            MCPServerConfiguration(
                name: "github",
                transport: .http(
                    endpoint: URL(string: "https://api.github.com/mcp")!,
                    streaming: false
                )
            )
        ]

        let data = try JSONEncoder().encode(configs)
        let decoded = try JSONDecoder().decode([MCPServerConfiguration].self, from: data)

        XCTAssertEqual(decoded, configs)
    }

    // MARK: - Identity / equality

    func testIdentifiableUsesStableId() {
        let id = UUID()
        let original = MCPServerConfiguration(
            id: id,
            name: "first",
            transport: .stdio(command: "x", arguments: [], environment: [:])
        )
        var mutated = original
        mutated.name = "renamed"
        mutated.isEnabled = false
        XCTAssertEqual(original.id, mutated.id)
    }

    func testEqualityComparesAllFields() {
        let id = UUID()
        let first = MCPServerConfiguration(
            id: id,
            name: "n",
            transport: .stdio(command: "x", arguments: [], environment: [:])
        )
        let second = MCPServerConfiguration(
            id: id,
            name: "n",
            transport: .stdio(command: "x", arguments: [], environment: [:])
        )
        let differentName = MCPServerConfiguration(
            id: id,
            name: "different",
            transport: .stdio(command: "x", arguments: [], environment: [:])
        )

        XCTAssertEqual(first, second)
        XCTAssertNotEqual(first, differentName)
    }

    func testHashableUsableAsDictionaryKey() {
        let cfg = MCPServerConfiguration(
            name: "n",
            transport: .stdio(command: "x", arguments: [], environment: [:])
        )
        var bag: Set<MCPServerConfiguration> = []
        bag.insert(cfg)
        XCTAssertTrue(bag.contains(cfg))
    }
}

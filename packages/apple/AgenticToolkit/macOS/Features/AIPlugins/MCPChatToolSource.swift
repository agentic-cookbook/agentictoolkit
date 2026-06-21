// macOS/Features/AIPlugins/MCPChatToolSource.swift
import Foundation
import MCP
import AgenticToolkitCore

/// `ChatToolSource` backed by an `MCPServerRegistry` and a fixed set of active
/// server ids. Mirrors the dispatch the chat view model used to do inline:
/// namespacing tool names `server__tool`, decoding arguments, flattening text
/// content. Decoupled from any engine via the `ChatToolSource` protocol.
public final class MCPChatToolSource: ChatToolSource, @unchecked Sendable {

    private let registry: MCPServerRegistry
    private let activeServerIds: Set<UUID>
    private static let separator = "__"

    public init(registry: MCPServerRegistry, activeServerIds: Set<UUID>) {
        self.registry = registry
        self.activeServerIds = activeServerIds
    }

    public func toolDefinitions() async -> [ToolDefinition] {
        let pairs = await registry.tools(forIds: activeServerIds)
        return pairs.compactMap { client, tool in
            guard let schema = try? JSONEncoder().encode(tool.inputSchema) else { return nil }
            return ToolDefinition(
                name: Self.namespaced(server: client.name, tool: tool.name),
                description: tool.description ?? "",
                parametersJSONSchema: schema
            )
        }
    }

    public func callTool(name: String, argumentsJSON: Data) async -> (content: String, isError: Bool) {
        let pairs = await registry.tools(forIds: activeServerIds)
        guard let pair = pairs.first(where: { Self.namespaced(server: $0.0.name, tool: $0.1.name) == name }) else {
            return ("Unknown tool: \(name)", true)
        }
        let arguments = try? JSONDecoder().decode([String: Value].self, from: argumentsJSON)
        do {
            let (content, isError) = try await pair.0.callTool(name: pair.1.name, arguments: arguments)
            return (Self.flatten(content), isError)
        } catch {
            return ("Tool error: \(error.localizedDescription)", true)
        }
    }

    private static func namespaced(server: String, tool: String) -> String { "\(server)\(separator)\(tool)" }

    private static func flatten(_ content: [MCP.Tool.Content]) -> String {
        content.compactMap { if case let .text(text, _, _) = $0 { return text } else { return nil } }
            .joined(separator: "\n")
    }
}

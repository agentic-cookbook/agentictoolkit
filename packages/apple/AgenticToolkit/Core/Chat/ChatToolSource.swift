// Core/Chat/ChatToolSource.swift
import Foundation

/// Supplies tools to a chat engine and executes tool calls. Lets an engine
/// (e.g. `LocalChatSession`) run a tool loop without depending on MCP directly —
/// the MCP-backed implementation lives in the macOS module.
public protocol ChatToolSource: Sendable {
    /// Tool definitions to advertise to the model for this turn.
    func toolDefinitions() async -> [ToolDefinition]
    /// Execute a tool call the model requested. Returns the result text and
    /// whether it was an error.
    func callTool(name: String, argumentsJSON: Data) async -> (content: String, isError: Bool)
}

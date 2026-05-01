//
//  MCPServerConfiguration.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import Foundation

/// User-editable description of one Model Context Protocol server.
///
/// The non-secret parts (id, name, transport details, environment variables that
/// aren't secrets) live here. Secret env values are stored separately under
/// `UserSettings.mcpServerSecrets`, keyed by `id.uuidString`, so they route to
/// the secure provider (Keychain) without leaking into the regular settings file.
public struct MCPServerConfiguration: Codable, Sendable, Identifiable, Equatable, Hashable {

    public enum Transport: Codable, Sendable, Equatable, Hashable {
        /// Local subprocess MCP server.
        case stdio(command: String, arguments: [String], environment: [String: String])
        /// Remote MCP server reachable over HTTP / SSE.
        case http(endpoint: URL, streaming: Bool)
    }

    public let id: UUID
    public var name: String
    public var transport: Transport
    public var isEnabled: Bool

    public init(
        id: UUID = UUID(),
        name: String,
        transport: Transport,
        isEnabled: Bool = true
    ) {
        self.id = id
        self.name = name
        self.transport = transport
        self.isEnabled = isEnabled
    }
}

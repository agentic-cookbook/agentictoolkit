//
//  HostMCPServer.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import Foundation
import MCP

import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// In-process MCP server that exposes a small toolset describing the host
/// application. Demonstrates the host-as-MCP-server pattern: tools defined
/// here can be consumed by the host's own chat window via an in-memory
/// transport, no subprocess required.
///
/// ### Usage
///
/// ```swift
/// let host = HostMCPServer(
///     appName: "AgenticToolkitApp",
///     appVersion: "1.0.0",
///     pluginNames: ["Claude (Local)", "OpenAI"],
///     openChatWindow: { coordinator.openNewWindow() }
/// )
/// try await host.start()
///
/// // Build an MCP.Client wired to host.clientTransport and pass that
/// // through whatever surface routes tool calls (registry adapter,
/// // direct chat-view-model wiring, etc.).
/// ```
///
/// The class is intentionally self-contained — registry integration is left
/// to the host application so the sample does not have to expand the
/// `MCPServerConfiguration.Transport` enum with an in-process variant.
@MainActor
public final class HostMCPServer {

    private let appName: String
    private let appVersion: String
    private let pluginNames: [String]
    private let openChatWindow: @Sendable () -> Void

    private let server: MCP.Server
    private let serverTransport: InMemoryTransport

    /// Client side of the in-memory transport pair. Hand this to an
    /// `MCP.Client.connect(transport:)` to talk to the host server.
    public let clientTransport: InMemoryTransport

    public init(
        appName: String,
        appVersion: String,
        pluginNames: [String] = [],
        openChatWindow: @Sendable @escaping () -> Void = {}
    ) async {
        self.appName = appName
        self.appVersion = appVersion
        self.pluginNames = pluginNames
        self.openChatWindow = openChatWindow

        let pair = await InMemoryTransport.createConnectedPair()
        self.clientTransport = pair.client
        self.serverTransport = pair.server

        self.server = MCP.Server(
            name: "host-app",
            version: appVersion,
            capabilities: MCP.Server.Capabilities(tools: .init(listChanged: false))
        )
    }

    public func start() async throws {
        await registerHandlers()
        try await server.start(transport: serverTransport)
    }

    public func stop() async {
        await server.stop()
    }

    // MARK: - Handlers

    private func registerHandlers() async {
        let appName = self.appName
        let appVersion = self.appVersion
        let pluginNames = self.pluginNames
        let openChatWindow = self.openChatWindow

        await server.withMethodHandler(ListTools.self) { _ in
            ListTools.Result(tools: HostMCPServer.staticToolDefinitions())
        }

        await server.withMethodHandler(CallTool.self) { params in
            switch params.name {
            case "host_app_info":
                let pluginList = pluginNames.isEmpty ? "(none)" : pluginNames.joined(separator: ", ")
                let body = """
                Host: \(appName)
                Version: \(appVersion)
                Plugins: \(pluginList)
                """
                return CallTool.Result(
                    content: [.text(text: body, annotations: nil, _meta: nil)],
                    isError: false
                )
            case "host_open_chat_window":
                openChatWindow()
                return CallTool.Result(
                    content: [.text(text: "Opened a new chat window.", annotations: nil, _meta: nil)],
                    isError: false
                )
            default:
                return CallTool.Result(
                    content: [.text(text: "Unknown tool: \(params.name)", annotations: nil, _meta: nil)],
                    isError: true
                )
            }
        }
    }

    private nonisolated static func staticToolDefinitions() -> [MCP.Tool] {
        [
            MCP.Tool(
                name: "host_app_info",
                description: "Return the host application's name, version, and configured AI plugins.",
                inputSchema: .object([
                    "type": .string("object"),
                    "properties": .object([:])
                ])
            ),
            MCP.Tool(
                name: "host_open_chat_window",
                description: "Open a new AI chat window in the host application.",
                inputSchema: .object([
                    "type": .string("object"),
                    "properties": .object([:])
                ])
            )
        ]
    }
}

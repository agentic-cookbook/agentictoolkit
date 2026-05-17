//
//  MCPClient.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import Foundation
import MCP
import OSLog
import System

public enum MCPClientState: Sendable, Equatable {
    case disconnected
    case connecting
    case connected
    case failed(String)
}

/// Surface that the registry, chat view-model, and settings UI consume. Backed
/// by `MCPClient` in production; tests substitute a fake conforming type via
/// `MCPServerRegistry.ClientFactory`.
public protocol MCPClientProtocol: Actor {
    nonisolated var id: UUID { get }
    nonisolated var name: String { get }
    var state: MCPClientState { get }
    var cachedTools: [MCP.Tool] { get }

    func connect() async throws
    func disconnect() async
    func refreshTools() async throws
    func callTool(
        name: String,
        arguments: [String: Value]?
    ) async throws -> (content: [MCP.Tool.Content], isError: Bool)
}

/// Per-server connection: owns the SDK client, its transport, and the cached
/// tool list. The registry creates one of these per enabled
/// `MCPServerConfiguration` and disposes it when the configuration changes,
/// is disabled, or removed.
public actor MCPClient: MCPClientProtocol {

    public typealias State = MCPClientState

    public nonisolated let id: UUID
    public nonisolated let name: String

    private let configuration: MCPServerConfiguration
    private let secrets: [String: String]
    private let client: MCP.Client
    private var transport: (any Transport)?
    private var process: Process?
    private(set) public var state: State = .disconnected
    private(set) public var cachedTools: [MCP.Tool] = []

    public init(
        configuration: MCPServerConfiguration,
        secrets: [String: String] = [:],
        clientName: String = "AgenticToolkit",
        clientVersion: String = "1.0.0"
    ) {
        self.id = configuration.id
        self.name = configuration.name
        self.configuration = configuration
        self.secrets = secrets
        self.client = MCP.Client(name: clientName, version: clientVersion)
    }

    /// Open the transport, perform initialization, and fetch the tool list.
    /// Caller is responsible for not connecting twice; calling on an already-
    /// connected client will throw from the underlying transport.
    public func connect() async throws {
        state = .connecting
        do {
            let transport = try makeTransport()
            self.transport = transport
            _ = try await client.connect(transport: transport)
            await registerToolListChangedHandler()
            try await refreshTools()
            state = .connected
        } catch {
            state = .failed("\(error)")
            await teardown()
            throw error
        }
    }

    public func disconnect() async {
        await teardown()
        state = .disconnected
    }

    /// Re-fetch the tool list from the server. Called automatically on connect
    /// and whenever the server emits `notifications/tools/list_changed`.
    public func refreshTools() async throws {
        let (tools, _) = try await client.listTools()
        cachedTools = tools
    }

    public func callTool(
        name: String,
        arguments: [String: Value]?
    ) async throws -> (content: [MCP.Tool.Content], isError: Bool) {
        let result = try await client.callTool(name: name, arguments: arguments)
        return (result.content, result.isError ?? false)
    }

    private func teardown() async {
        await client.disconnect()
        transport = nil
        if let process, process.isRunning {
            process.terminate()
        }
        process = nil
    }

    private func registerToolListChangedHandler() async {
        await client.onNotification(ToolListChangedNotification.self) { [weak self] _ in
            guard let self else { return }
            try? await self.refreshTools()
        }
    }

    private func makeTransport() throws -> any Transport {
        switch configuration.transport {
        case let .stdio(command, arguments, environment):
            return try makeStdioTransport(
                command: command,
                arguments: arguments,
                environment: environment.merging(secrets) { _, secret in secret }
            )
        case let .http(endpoint, streaming):
            return HTTPClientTransport(endpoint: endpoint, streaming: streaming)
        }
    }

    private func makeStdioTransport(
        command: String,
        arguments: [String],
        environment: [String: String]
    ) throws -> StdioTransport {
        let stdin = Pipe()
        let stdout = Pipe()
        let stderr = Pipe()

        let process = Process()
        process.executableURL = URL(fileURLWithPath: command)
        process.arguments = arguments
        process.standardInput = stdin
        process.standardOutput = stdout
        process.standardError = stderr
        if !environment.isEmpty {
            process.environment = ProcessInfo.processInfo.environment
                .merging(environment) { _, new in new }
        }

        try process.run()
        self.process = process

        let inputFD = FileDescriptor(rawValue: stdout.fileHandleForReading.fileDescriptor)
        let outputFD = FileDescriptor(rawValue: stdin.fileHandleForWriting.fileDescriptor)

        return StdioTransport(input: inputFD, output: outputFD)
    }
}

extension MCPClient: Loggable {
    public static nonisolated let logger = makeLogger()
}

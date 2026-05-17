//
//  MCPServerRegistry.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import Foundation
import Combine
import MCP
import OSLog

/// Reconciles a set of live `MCPClient`s against the configurations stored in
/// `SettingsStore`. Hosts (the chat view-model, settings panel, host app)
/// observe the registry; the registry owns the lifecycle of each connection.
///
/// Tests inject a custom `clientFactory` to avoid spawning real subprocesses
/// or HTTP connections.
@MainActor
public final class MCPServerRegistry: ObservableObject {

    public typealias ClientFactory = @MainActor (
        _ configuration: MCPServerConfiguration,
        _ secrets: [String: String]
    ) -> any MCPClientProtocol

    /// Live clients keyed by configuration id. Only enabled configurations
    /// have an entry.
    @Published public private(set) var clients: [UUID: any MCPClientProtocol] = [:]

    private let store: SettingsStore
    private let clientFactory: ClientFactory
    private var cancellables: Set<AnyCancellable> = []

    public init(
        store: SettingsStore,
        clientFactory: @escaping ClientFactory = { config, secrets in
            MCPClient(configuration: config, secrets: secrets)
        }
    ) {
        self.store = store
        self.clientFactory = clientFactory

        store.publisher(for: UserSettings.mcpServerConfigurations)
            .combineLatest(store.publisher(for: UserSettings.mcpServerSecrets))
            .sink { [weak self] configurations, secrets in
                guard let self else { return }
                self.reconcile(configurations: configurations, secrets: secrets)
            }
            .store(in: &cancellables)
    }

    public func client(for id: UUID) -> (any MCPClientProtocol)? {
        clients[id]
    }

    /// Returns `(client, tool)` pairs for every cached tool exposed by the
    /// listed servers. Callers namespace tool names as `<serverName>.<toolName>`
    /// when assembling the tool list to avoid collisions across servers.
    public func tools(forIds ids: Set<UUID>) async -> [(any MCPClientProtocol, MCP.Tool)] {
        var result: [(any MCPClientProtocol, MCP.Tool)] = []
        for id in ids {
            guard let client = clients[id] else { continue }
            let tools = await client.cachedTools
            for tool in tools {
                result.append((client, tool))
            }
        }
        return result
    }

    private func reconcile(
        configurations: [MCPServerConfiguration],
        secrets: MCPServerSecrets
    ) {
        let enabled = configurations.filter(\.isEnabled)
        let desiredIds = Set(enabled.map(\.id))

        for (id, client) in clients where !desiredIds.contains(id) {
            Task { await client.disconnect() }
            clients.removeValue(forKey: id)
        }

        for configuration in enabled where clients[configuration.id] == nil {
            let serverSecrets = secrets[configuration.id.uuidString] ?? [:]
            let client = clientFactory(configuration, serverSecrets)
            clients[configuration.id] = client
            Task {
                do {
                    try await client.connect()
                } catch {
                    let serverName = configuration.name
                    let message = error.localizedDescription
                    Self.logger.error(
                        "Failed to connect MCP server \(serverName, privacy: .public): \(message, privacy: .public)"
                    )
                }
            }
        }
    }
}

extension MCPServerRegistry: Loggable {
    public static nonisolated let logger = makeLogger()
}

//
//  MCPServersPanelViewController.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import AppKit
import Combine
import Foundation
import SwiftUI

import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// Premade settings panel for managing Model Context Protocol server configurations.
///
/// Mirrors `AIPanelViewController`: subclass adds a child sub-panel that hosts
/// the actual editor. The panel reads/writes through the supplied
/// `SettingsStore`; non-secret rows route to the regular provider, secret env
/// values to the secure provider. The supplied `MCPServerRegistry` is observed
/// to drive a live "connected" indicator on each row.
@MainActor
public final class MCPServersPanelViewController: ComposableSettings.SettingsPanelSplitViewController {

    private let registry: MCPServerRegistry
    private let store: SettingsStore

    public init(registry: MCPServerRegistry, store: SettingsStore) {
        self.registry = registry
        self.store = store
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "MCP Servers",
            icon: NSImage(systemSymbolName: "server.rack", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        addPanel(MCPServersListPanelViewController(registry: registry, store: store))
    }
}

/// Single sub-panel that hosts the SwiftUI editor.
@MainActor
private final class MCPServersListPanelViewController: ComposableSettings.SettingsPanelViewController {

    private let viewModel: MCPServersListViewModel

    init(registry: MCPServerRegistry, store: SettingsStore) {
        self.viewModel = MCPServersListViewModel(registry: registry, store: store)
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Servers",
            icon: NSImage(systemSymbolName: "list.bullet", accessibilityDescription: nil)
        ))
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func loadView() {
        let hosting = NSHostingView(rootView: MCPServersListView(viewModel: viewModel))
        hosting.translatesAutoresizingMaskIntoConstraints = false
        self.view = hosting
    }
}

// MARK: - View model

@MainActor
final class MCPServersListViewModel: ObservableObject {

    @Published var configurations: [MCPServerConfiguration] = []
    @Published var connectedIds: Set<UUID> = []

    private let store: SettingsStore
    private var cancellables: Set<AnyCancellable> = []

    init(registry: MCPServerRegistry, store: SettingsStore) {
        self.store = store

        store.publisher(for: UserSettings.mcpServerConfigurations)
            .sink { [weak self] in self?.configurations = $0 }
            .store(in: &cancellables)

        registry.$clients
            .map { Set($0.keys) }
            .sink { [weak self] in self?.connectedIds = $0 }
            .store(in: &cancellables)
    }

    func setEnabled(_ id: UUID, enabled: Bool) {
        var current = configurations
        guard let index = current.firstIndex(where: { $0.id == id }) else { return }
        current[index].isEnabled = enabled
        store.set(current, for: UserSettings.mcpServerConfigurations)
    }

    func remove(_ id: UUID) {
        let next = configurations.filter { $0.id != id }
        store.set(next, for: UserSettings.mcpServerConfigurations)

        var secrets = store.get(UserSettings.mcpServerSecrets)
        if secrets.removeValue(forKey: id.uuidString) != nil {
            store.set(secrets, for: UserSettings.mcpServerSecrets)
        }
    }

    func add(_ configuration: MCPServerConfiguration) {
        var current = configurations
        current.append(configuration)
        store.set(current, for: UserSettings.mcpServerConfigurations)
    }
}

// MARK: - SwiftUI views

private struct MCPServersListView: View {

    @ObservedObject var viewModel: MCPServersListViewModel
    @State private var showingAdd = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Configured Servers")
                    .font(.headline)
                Spacer()
                Button("Add Server…") { showingAdd = true }
            }

            if viewModel.configurations.isEmpty {
                Text("No MCP servers configured.")
                    .foregroundStyle(.secondary)
                    .padding(.vertical, 8)
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(viewModel.configurations.enumerated()), id: \.element.id) { index, config in
                        MCPServerRow(
                            configuration: config,
                            isConnected: viewModel.connectedIds.contains(config.id),
                            onToggle: { viewModel.setEnabled(config.id, enabled: $0) },
                            onRemove: { viewModel.remove(config.id) }
                        )
                        if index < viewModel.configurations.count - 1 {
                            Divider()
                        }
                    }
                }
            }

            Spacer(minLength: 0)
        }
        .padding(20)
        .frame(minWidth: 480, minHeight: 240, alignment: .topLeading)
        .sheet(isPresented: $showingAdd) {
            MCPAddServerSheet(
                onCommit: { configuration in
                    viewModel.add(configuration)
                    showingAdd = false
                },
                onCancel: { showingAdd = false }
            )
        }
    }
}

private struct MCPServerRow: View {

    let configuration: MCPServerConfiguration
    let isConnected: Bool
    let onToggle: (Bool) -> Void
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Circle()
                .fill(isConnected ? Color.green : Color.secondary)
                .frame(width: 8, height: 8)
                .help(isConnected ? "Connected" : "Not connected")

            VStack(alignment: .leading, spacing: 2) {
                Text(configuration.name)
                    .font(.body)
                Text(transportSummary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }

            Spacer()

            Toggle("", isOn: Binding(
                get: { configuration.isEnabled },
                set: { onToggle($0) }
            ))
            .labelsHidden()
            .help("Enabled")

            Button(action: onRemove) {
                Image(systemName: "trash")
            }
            .buttonStyle(.borderless)
            .help("Remove server")
        }
        .padding(.vertical, 8)
    }

    private var transportSummary: String {
        switch configuration.transport {
        case .stdio(let command, let arguments, _):
            let argString = arguments.joined(separator: " ")
            let combined = "\(command) \(argString)".trimmingCharacters(in: .whitespaces)
            return "stdio · \(combined)"
        case .http(let endpoint, let streaming):
            let suffix = streaming ? " (sse)" : ""
            return "http\(suffix) · \(endpoint.absoluteString)"
        }
    }
}

private struct MCPAddServerSheet: View {

    enum TransportKind: String, CaseIterable, Identifiable {
        case stdio
        case http

        var id: String { rawValue }

        var label: String {
            switch self {
            case .stdio: return "stdio (subprocess)"
            case .http: return "HTTP / SSE"
            }
        }
    }

    var onCommit: (MCPServerConfiguration) -> Void
    var onCancel: () -> Void

    @State private var name: String = ""
    @State private var transportKind: TransportKind = .stdio
    @State private var command: String = ""
    @State private var argumentsText: String = ""
    @State private var endpoint: String = ""
    @State private var streaming: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Add MCP Server")
                .font(.title3)
                .bold()

            Form {
                TextField("Name", text: $name)

                Picker("Transport", selection: $transportKind) {
                    ForEach(TransportKind.allCases) { kind in
                        Text(kind.label).tag(kind)
                    }
                }

                switch transportKind {
                case .stdio:
                    TextField("Command", text: $command)
                        .help("Path to the MCP server executable, e.g. /opt/homebrew/bin/npx")
                    TextField("Arguments", text: $argumentsText)
                        .help("Space-separated arguments")
                case .http:
                    TextField("Endpoint URL", text: $endpoint)
                    Toggle("Streaming (SSE)", isOn: $streaming)
                }
            }

            HStack {
                Spacer()
                Button("Cancel", action: onCancel)
                    .keyboardShortcut(.cancelAction)
                Button("Add") { commit() }
                    .keyboardShortcut(.defaultAction)
                    .disabled(!isValid)
            }
        }
        .padding(20)
        .frame(minWidth: 440)
    }

    private var isValid: Bool {
        guard !name.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        switch transportKind {
        case .stdio:
            return !command.trimmingCharacters(in: .whitespaces).isEmpty
        case .http:
            guard let url = URL(string: endpoint), url.scheme != nil else { return false }
            return true
        }
    }

    private func commit() {
        let trimmedName = name.trimmingCharacters(in: .whitespaces)
        let transport: MCPServerConfiguration.Transport

        switch transportKind {
        case .stdio:
            let arguments = argumentsText
                .split(whereSeparator: \.isWhitespace)
                .map(String.init)
            transport = .stdio(
                command: command.trimmingCharacters(in: .whitespaces),
                arguments: arguments,
                environment: [:]
            )
        case .http:
            guard let url = URL(string: endpoint) else { return }
            transport = .http(endpoint: url, streaming: streaming)
        }

        onCommit(MCPServerConfiguration(
            name: trimmedName,
            transport: transport,
            isEnabled: true
        ))
    }
}

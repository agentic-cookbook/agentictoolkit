//
//  MCPChipsBarView.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import AppKit
import Combine
import SwiftUI

import AgenticToolkitCore

/// Header bar that lets the user pick which configured MCP servers are
/// active for this chat. Hosts a SwiftUI view inside an `NSHostingView`.
///
/// The view binds to `ChatViewModel.activeServerIds` so toggles flow
/// through to the same set the dispatch loop reads when assembling tool
/// definitions for the next turn.
@MainActor
final class MCPChipsBarView: NSView {

    init(viewModel: ChatViewModel, registry: MCPServerRegistry) {
        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        let model = MCPChipsBarViewModel(viewModel: viewModel, registry: registry)
        let hosting = NSHostingView(rootView: MCPChipsBar(viewModel: model))
        hosting.translatesAutoresizingMaskIntoConstraints = false
        addSubview(hosting)

        NSLayoutConstraint.activate([
            hosting.topAnchor.constraint(equalTo: topAnchor),
            hosting.leadingAnchor.constraint(equalTo: leadingAnchor),
            hosting.trailingAnchor.constraint(equalTo: trailingAnchor),
            hosting.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }
}

@MainActor
private final class MCPChipsBarViewModel: ObservableObject {

    @Published var availableServerIds: [UUID] = []
    @Published var serverNames: [UUID: String] = [:]

    let chatViewModel: ChatViewModel
    private var cancellables: Set<AnyCancellable> = []

    init(viewModel: ChatViewModel, registry: MCPServerRegistry) {
        self.chatViewModel = viewModel

        registry.$clients
            .sink { [weak self] clients in
                guard let self else { return }
                self.availableServerIds = Array(clients.keys).sorted { lhs, rhs in
                    let lhsName = clients[lhs]?.name ?? ""
                    let rhsName = clients[rhs]?.name ?? ""
                    return lhsName.localizedCaseInsensitiveCompare(rhsName) == .orderedAscending
                }
                var names: [UUID: String] = [:]
                for (id, client) in clients {
                    names[id] = client.name
                }
                self.serverNames = names
            }
            .store(in: &cancellables)
    }

    func isActive(_ id: UUID) -> Bool {
        chatViewModel.activeServerIds.contains(id)
    }

    func toggle(_ id: UUID) {
        if chatViewModel.activeServerIds.contains(id) {
            chatViewModel.activeServerIds.remove(id)
        } else {
            chatViewModel.activeServerIds.insert(id)
        }
    }
}

private struct MCPChipsBar: View {

    @ObservedObject var viewModel: MCPChipsBarViewModel
    @State private var showingPicker = false

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "server.rack")
                .foregroundStyle(.secondary)

            Button {
                showingPicker.toggle()
            } label: {
                HStack(spacing: 4) {
                    Text(buttonLabel)
                    Image(systemName: "chevron.down")
                        .font(.caption2)
                }
            }
            .buttonStyle(.borderless)
            .popover(isPresented: $showingPicker, arrowEdge: .bottom) {
                MCPServerPicker(viewModel: viewModel)
            }

            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
    }

    private var buttonLabel: String {
        let active = viewModel.chatViewModel.activeServerIds.intersection(Set(viewModel.availableServerIds))
        if viewModel.availableServerIds.isEmpty {
            return "No MCP servers"
        }
        if active.isEmpty {
            return "MCP: none"
        }
        return "MCP: \(active.count) of \(viewModel.availableServerIds.count)"
    }
}

private struct MCPServerPicker: View {

    @ObservedObject var viewModel: MCPChipsBarViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Active MCP Servers")
                .font(.headline)

            if viewModel.availableServerIds.isEmpty {
                Text("No connected servers.\nAdd one in Settings → MCP Servers.")
                    .foregroundStyle(.secondary)
                    .font(.callout)
            } else {
                ForEach(viewModel.availableServerIds, id: \.self) { id in
                    Toggle(isOn: Binding(
                        get: { viewModel.isActive(id) },
                        set: { _ in viewModel.toggle(id) }
                    )) {
                        Text(viewModel.serverNames[id] ?? "Unknown")
                    }
                    .toggleStyle(.checkbox)
                }
            }
        }
        .padding(14)
        .frame(minWidth: 220)
    }
}

import SwiftUI
import AppKit
import AIPluginKit
import AgenticToolkitCore

/// The LLM Providers settings panel body: a list of configured providers with a
/// `+` provider menu and `−` remove, beside an editor for the selected row.
struct LLMProvidersView: View {

    @ObservedObject var viewModel: LLMProvidersListViewModel

    var body: some View {
        HStack(spacing: 0) {
            listColumn
                .frame(width: 240)
            Divider()
            detailColumn
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        }
        .frame(minWidth: 640, minHeight: 380, alignment: .topLeading)
    }

    private var listColumn: some View {
        VStack(spacing: 0) {
            List(selection: Binding(
                get: { viewModel.selectedId },
                set: { viewModel.selectedId = $0 }
            )) {
                ForEach(viewModel.configurations) { config in
                    VStack(alignment: .leading, spacing: 1) {
                        Text(config.name)
                        Text(providerLabel(config))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .tag(config.id)
                }
            }
            .listStyle(.inset)

            Divider()
            HStack(spacing: 2) {
                addMenu
                Button {
                    if let id = viewModel.selectedId { viewModel.remove(id) }
                } label: { Image(systemName: "minus") }
                    .buttonStyle(.borderless)
                    .disabled(viewModel.selectedId == nil)
                    .help("Remove the selected provider")
                Spacer()
            }
            .padding(6)
        }
    }

    private var addMenu: some View {
        Menu {
            ForEach(Array(viewModel.availableTemplates.enumerated()), id: \.offset) { _, available in
                Button(available.template.displayName) { viewModel.add(available) }
            }
        } label: {
            Image(systemName: "plus")
        }
        .menuStyle(.borderlessButton)
        .fixedSize()
        .help("Add a provider")
    }

    @ViewBuilder
    private var detailColumn: some View {
        if let id = viewModel.selectedId, let config = viewModel.configuration(for: id) {
            LLMProviderEditorView(configuration: config, viewModel: viewModel)
                .id(config.id)
                .padding(20)
        } else {
            Text("Select or add a provider.")
                .foregroundStyle(.secondary)
                .padding(20)
        }
    }

    private func providerLabel(_ config: AIProviderConfiguration) -> String {
        viewModel.pluginManager
            .template(pluginIdentifier: config.pluginIdentifier, templateId: config.templateId)?
            .displayName ?? config.templateId
    }
}

/// Temporary placeholder — replaced by the real editor in Task 8.
struct LLMProviderEditorView: View {
    let configuration: AIProviderConfiguration
    @ObservedObject var viewModel: LLMProvidersListViewModel
    var body: some View { Text(configuration.name).font(.title3) }
}

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

/// Editor for one configuration: rename, model, per-template fields, and a live
/// chat test pinned to this configuration.
struct LLMProviderEditorView: View {

    let configuration: AIProviderConfiguration
    @ObservedObject var viewModel: LLMProvidersListViewModel
    @State private var name: String

    init(configuration: AIProviderConfiguration, viewModel: LLMProvidersListViewModel) {
        self.configuration = configuration
        self.viewModel = viewModel
        _name = State(initialValue: configuration.name)
    }

    private var template: AIPluginDescriptor.ProviderTemplate? {
        viewModel.pluginManager.template(
            pluginIdentifier: configuration.pluginIdentifier, templateId: configuration.templateId
        )
    }

    private var fields: [AIPluginDescriptor.Field] {
        guard let template else { return [] }
        return viewModel.pluginManager.descriptor(for: configuration.pluginIdentifier)?
            .fields(for: template) ?? (template.fields ?? [])
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Form {
                TextField("Name", text: $name)
                    .onSubmit {
                        viewModel.rename(configuration.id, to: name)
                        name = viewModel.configuration(for: configuration.id)?.name ?? name
                    }

                if let template, !template.models.isEmpty {
                    Picker("Model", selection: modelBinding(template)) {
                        ForEach(template.models, id: \.self) { Text($0).tag($0) }
                    }
                }

                ForEach(fields, id: \.key) { field in
                    if field.isSecret {
                        SecureField(field.label, text: fieldBinding(field))
                    } else {
                        TextField(field.label, text: fieldBinding(field),
                                  prompt: field.placeholder.map(Text.init))
                    }
                }
            }

            Divider()
            Text("Test").font(.headline)
            ChatTestView(configuration: configuration, pluginManager: viewModel.pluginManager)
                .frame(minHeight: 160)
        }
    }

    private func fieldBinding(_ field: AIPluginDescriptor.Field) -> Binding<String> {
        let setting = AIProviderConfigStore.fieldSetting(config: configuration.id, field: field)
        return Binding(get: { setting.currentValue }, set: { setting.value = $0 })
    }

    private func modelBinding(_ template: AIPluginDescriptor.ProviderTemplate) -> Binding<String> {
        let setting = AIProviderConfigStore.modelSetting(config: configuration.id, template: template)
        return Binding(
            get: { let stored = setting.currentValue; return stored.isEmpty ? template.resolvedDefaultModel : stored },
            set: { setting.value = $0 }
        )
    }
}

/// Embeds the existing AppKit `ChatView` (driven by an `AIPluginChatBackend`
/// pinned to this configuration) inside SwiftUI.
private struct ChatTestView: NSViewRepresentable {
    let configuration: AIProviderConfiguration
    let pluginManager: AIPluginManager

    func makeCoordinator() -> Coordinator {
        Coordinator(configuration: configuration, pluginManager: pluginManager)
    }

    func makeNSView(context: Context) -> NSView { context.coordinator.chatView }
    func updateNSView(_ nsView: NSView, context: Context) {}

    @MainActor
    final class Coordinator {
        let provider: SingleConfigurationChatConfigProvider
        let backend: AIPluginChatBackend
        let chatView: ChatView
        init(configuration: AIProviderConfiguration, pluginManager: AIPluginManager) {
            self.provider = SingleConfigurationChatConfigProvider(
                configuration: configuration, pluginManager: pluginManager)
            self.backend = AIPluginChatBackend(pluginManager: pluginManager, configProvider: provider)
            self.chatView = ChatView(viewModel: ChatViewModel(backend: backend))
        }
    }
}

import SwiftUI
import AppKit
import AIPluginKit
import AgenticToolkitCore

/// Editor for one configuration: rename, model, per-template fields, and a live
/// chat test pinned to this configuration.
struct LLMProviderEditorView: View {

    let configuration: AIProviderConfiguration
    @ObservedObject var viewModel: LLMProvidersListViewModel
    @State private var name: String
    /// The displayed model, mirrored into view state so picking one updates the
    /// label immediately (the underlying store is not SwiftUI-observable).
    @State private var currentModel: String
    @State private var showModelPicker = false

    init(configuration: AIProviderConfiguration, viewModel: LLMProvidersListViewModel) {
        self.configuration = configuration
        self.viewModel = viewModel
        _name = State(initialValue: configuration.name)
        let template = viewModel.pluginManager.template(
            pluginIdentifier: configuration.pluginIdentifier, templateId: configuration.templateId
        )
        let model = template.map { AIProviderConfigStore.selectedModel(config: configuration, template: $0) }
        _currentModel = State(initialValue: model ?? "")
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

    /// The provider identity shown as the detail-pane title (distinct from the
    /// user's editable Name below), e.g. "Anthropic API".
    private var title: String { template?.displayName ?? configuration.name }

    /// Provider · LLM · Config Type, e.g. "Anthropic · Claude · API Key".
    private var subtitle: String {
        guard let template else { return configuration.templateId }
        var parts = [template.resolvedProvider]
        if !template.resolvedLLM.isEmpty { parts.append(template.resolvedLLM) }
        parts.append(template.resolvedConfigType)
        return parts.joined(separator: " · ")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.title2)
                    .bold()
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Form {
                TextField("Name", text: $name)
                    .onSubmit {
                        viewModel.rename(configuration.id, to: name)
                        name = viewModel.configuration(for: configuration.id)?.name ?? name
                    }

                if let template, !template.models.isEmpty {
                    modelRow(template)
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

            Spacer(minLength: 0)
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    /// The Model row: a "popdown" button showing the current model that opens a
    /// filterable, keyboard-navigable model picker (rich per-model info).
    @ViewBuilder
    private func modelRow(_ template: AIPluginDescriptor.ProviderTemplate) -> some View {
        let binding = modelBinding(template)
        LabeledContent("Model") {
            Button {
                showModelPicker = true
            } label: {
                HStack(spacing: 6) {
                    Text(currentModel.isEmpty ? template.resolvedDefaultModel : currentModel)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.bordered)
            .popover(isPresented: $showModelPicker, arrowEdge: .bottom) {
                ModelPickerHost(
                    items: modelItems(template),
                    selected: currentModel.isEmpty ? template.resolvedDefaultModel : currentModel,
                    onSelect: { binding.wrappedValue = $0; currentModel = $0; showModelPicker = false },
                    onDismiss: { showModelPicker = false }
                )
                .frame(width: 380, height: modelPickerHeight(template))
            }
        }
    }

    private func modelItems(_ template: AIPluginDescriptor.ProviderTemplate) -> [ModelPickerItem] {
        template.models.map { model in
            let detail = template.modelDetail(for: model)
            return ModelPickerItem(id: model, description: detail?.description,
                                   tools: detail?.tools, goodFor: detail?.goodFor)
        }
    }

    private func modelPickerHeight(_ template: AIPluginDescriptor.ProviderTemplate) -> CGFloat {
        let rows = min(max(template.models.count, 1), 6)
        return min(16 + 24 + 8 + CGFloat(rows) * 56 + 12, 440)
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

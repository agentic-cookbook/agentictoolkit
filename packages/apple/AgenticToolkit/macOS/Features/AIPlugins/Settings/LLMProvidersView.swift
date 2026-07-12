import SwiftUI
import AppKit
import AIPluginKit
import AgenticToolkitCore

/// Editor for one configuration: rename, model, per-template fields, and a live
/// chat test pinned to this configuration.
struct LLMProviderEditorView: View {

    let configuration: AIProviderConfiguration
    @ObservedObject var viewModel: LLMProvidersListViewModel
    /// The chat test + its backend, owned by the hosting view controller so the
    /// same session is reachable for scripted tests; model changes post a notice
    /// into its live transcript.
    let chat: ChatSession
    @State private var name: String
    /// The displayed model, mirrored into view state so picking one updates the
    /// label immediately (the underlying store is not SwiftUI-observable).
    @State private var currentModel: String
    @State private var showModelPicker = false
    /// Models the provider's `/models` endpoint actually serves, when reachable;
    /// empty falls back to the template's static list.
    @State private var fetchedModels: [String] = []
    /// The base URL `fetchedModels` was fetched for, so a repeat appear/open with an
    /// unchanged endpoint skips the network.
    @State private var fetchedBaseURL: String?
    /// True while a live `/models` fetch is in flight, so the Model row can show a
    /// "finding models" hint instead of an empty picker (the fetch can lag a few
    /// seconds when the local server is busy serving other requests).
    @State private var isFetchingModels = false

    init(configuration: AIProviderConfiguration, viewModel: LLMProvidersListViewModel, chat: ChatSession) {
        self.configuration = configuration
        self.viewModel = viewModel
        self.chat = chat
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
        return viewModel.pluginManager.fields(
            pluginIdentifier: configuration.pluginIdentifier, template: template
        )
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

                // Show the Model row whenever the provider can offer a model: a live-fetch
                // provider (Ollama etc.) always shows it so the fetched list can populate the
                // picker even though its static list is empty; others show it when they ship a
                // static list, a fetch resolved, or a model is already chosen.
                if let template,
                   supportsLiveModels || !template.models.isEmpty || !fetchedModels.isEmpty || !currentModel.isEmpty {
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
            ChatTestView(viewModel: chat.viewModel)
                .frame(minHeight: 160)

            Spacer(minLength: 0)
        }
        .padding(20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task { await refreshModels() }
    }

    /// The Model row: a "popdown" button showing the current model (with its
    /// descriptive info beneath, when known) that opens a filterable,
    /// keyboard-navigable model picker.
    @ViewBuilder
    private func modelRow(_ template: AIPluginDescriptor.ProviderTemplate) -> some View {
        let resolved = currentModel.isEmpty ? template.resolvedDefaultModel : currentModel
        LabeledContent("Model") {
            VStack(alignment: .leading, spacing: 4) {
                Button {
                    Task { await refreshModels() }
                    showModelPicker = true
                } label: {
                    HStack(spacing: 6) {
                        Text(resolved.isEmpty ? "Choose a model…" : resolved)
                            .foregroundStyle(resolved.isEmpty ? AnyShapeStyle(.secondary) : AnyShapeStyle(.primary))
                        Image(systemName: "chevron.up.chevron.down")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.bordered)
                .popover(isPresented: $showModelPicker, arrowEdge: .bottom) {
                    ModelPickerHost(
                        items: modelItems(template),
                        selected: resolved,
                        onSelect: { selectModel($0, template: template) },
                        onDismiss: { showModelPicker = false }
                    )
                    .frame(width: 380, height: modelPickerHeight(template))
                }

                if isFetchingModels && fetchedModels.isEmpty {
                    Text("Finding installed models…")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else if let detail = template.modelDetail(for: resolved) {
                    modelInfo(detail)
                }
            }
        }
    }

    /// The description + capabilities of the currently-selected model.
    @ViewBuilder
    private func modelInfo(_ detail: AIPluginDescriptor.ModelDetail) -> some View {
        let item = ModelPickerItem(id: detail.id, description: detail.description,
                                   tools: detail.tools, goodFor: detail.goodFor)
        VStack(alignment: .leading, spacing: 1) {
            if let description = detail.description, !description.isEmpty {
                Text(description).font(.caption).foregroundStyle(.secondary)
            }
            if let capabilities = item.capabilities {
                Text(capabilities).font(.caption2).foregroundStyle(.tertiary)
            }
        }
    }

    /// Commits a model choice: persist it, refresh the label, and — if a chat is
    /// under way — post a "Model changed to …" notice into the transcript.
    /// `currentModel` (@State) is the single source of truth for display; the store
    /// write is the sole persistence side effect.
    private func selectModel(_ model: String, template: AIPluginDescriptor.ProviderTemplate) {
        let previous = currentModel.isEmpty ? template.resolvedDefaultModel : currentModel
        AIProviderConfigStore.modelSetting(config: configuration.id, template: template).value = model
        currentModel = model
        if model != previous { chat.viewModel.noteModelChanged(to: model) }
        showModelPicker = false
    }

    /// Models to offer: the provider's live list when reachable, else the
    /// template's static list — always including the active selection so a model
    /// dropped from the list (e.g. one retired since it was chosen) stays visible
    /// and re-selectable rather than vanishing from the picker.
    private func availableModels(_ template: AIPluginDescriptor.ProviderTemplate) -> [String] {
        let listed = fetchedModels.isEmpty ? template.models : fetchedModels
        let current = currentModel.isEmpty ? template.resolvedDefaultModel : currentModel
        return Self.offeredModels(listed: listed, current: current)
    }

    /// Picker contents: `listed` plus `current` when it isn't already present, so a
    /// since-retired stored selection stays visible/re-selectable instead of
    /// silently absent. An empty `current` (no default) adds nothing. Pure so the
    /// picker's fallback behaviour is unit-testable without a live view.
    nonisolated static func offeredModels(listed: [String], current: String) -> [String] {
        guard !current.isEmpty, !listed.contains(current) else { return listed }
        return listed + [current]
    }

    private func modelItems(_ template: AIPluginDescriptor.ProviderTemplate) -> [ModelPickerItem] {
        availableModels(template).map { model in
            let detail = template.modelDetail(for: model)
            return ModelPickerItem(id: model, description: detail?.description,
                                   tools: detail?.tools, goodFor: detail?.goodFor)
        }
    }

    private func modelPickerHeight(_ template: AIPluginDescriptor.ProviderTemplate) -> CGFloat {
        let rows = min(max(availableModels(template).count, 1), 6)
        return min(16 + 24 + 8 + CGFloat(rows) * 56 + 12, 440)
    }

    /// Only OpenAI-shaped endpoints serve `GET {baseURL}/models`; other providers
    /// (Anthropic, Google, local CLI) have static model lists, so probing them would
    /// just fire a doomed request. Gate live fetching on the plugin identity.
    private var supportsLiveModels: Bool {
        let id = configuration.pluginIdentifier
        return id.hasSuffix(".openai-compatible") || id.hasSuffix(".openai")
    }

    /// Best-effort fetch of the provider's live model list from its `/models`
    /// endpoint. No-op when the provider isn't OpenAI-shaped, has no base URL, or was
    /// already fetched for this exact base URL (avoids re-hitting the network on
    /// every editor appear + picker open).
    @MainActor
    private func refreshModels() async {
        guard supportsLiveModels, let template else { return }
        let values = AIProviderConfigStore.configValues(
            for: configuration, template: template, fields: fields
        )
        let baseURL = values["baseURL"] ?? ""
        guard !baseURL.isEmpty else { return }
        guard baseURL != fetchedBaseURL || fetchedModels.isEmpty else { return }
        isFetchingModels = true
        defer { isFetchingModels = false }
        let models = await OpenAIModelCatalog.fetch(baseURL: baseURL, apiKey: values["apiKey"])
        if !models.isEmpty {
            fetchedModels = models
            fetchedBaseURL = baseURL
        }
    }

    private func fieldBinding(_ field: AIPluginDescriptor.Field) -> Binding<String> {
        let setting = AIProviderConfigStore.fieldSetting(config: configuration.id, field: field)
        return Binding(get: { setting.currentValue }, set: { setting.value = $0 })
    }
}

/// Owns the chat test's object graph for one configuration — the live config
/// provider, the plugin backend, and the view model — so the editor can drive
/// the same `ChatViewModel` the transcript renders (e.g. to post model-change
/// notices). The backend holds the provider weakly, so this strong reference
/// keeps it alive.
@MainActor
final class ChatSession: ObservableObject {
    let provider: SingleConfigurationChatConfigProvider
    let backend: AIPluginChatBackend
    let viewModel: ChatViewModel

    init(configuration: AIProviderConfiguration, pluginManager: AIPluginManager) {
        self.provider = SingleConfigurationChatConfigProvider(
            configuration: configuration, pluginManager: pluginManager)
        self.backend = AIPluginChatBackend(pluginManager: pluginManager, configProvider: provider)
        self.viewModel = ChatViewModel(backend: backend)
    }
}

/// Embeds the existing AppKit `ChatView` for a supplied `ChatViewModel`.
private struct ChatTestView: NSViewRepresentable {
    let viewModel: ChatViewModel

    func makeNSView(context: Context) -> NSView { ChatView(viewModel: viewModel) }
    func updateNSView(_ nsView: NSView, context: Context) {}
}

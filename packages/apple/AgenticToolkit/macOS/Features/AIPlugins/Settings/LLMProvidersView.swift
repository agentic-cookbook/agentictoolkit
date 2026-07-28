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
    let chat: ChatTestSession
    @State private var name: String
    /// The displayed model, mirrored into view state so picking one updates the
    /// label immediately (the underlying store is not SwiftUI-observable).
    @State private var currentModel: String

    init(configuration: AIProviderConfiguration, viewModel: LLMProvidersListViewModel, chat: ChatTestSession) {
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
                // provider (Ollama etc.) always shows it so the modal chooser's live fetch can
                // populate it even though its static list is empty; others show it when they
                // ship a static list or a model is already chosen.
                if let template,
                   ModelChooserContent.supportsLiveModels(pluginIdentifier: configuration.pluginIdentifier)
                    || !template.models.isEmpty || !currentModel.isEmpty {
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
    }

    @ViewBuilder
    private func modelRow(_ template: AIPluginDescriptor.ProviderTemplate) -> some View {
        let resolved = currentModel.isEmpty ? template.resolvedDefaultModel : currentModel
        LabeledContent("Model") {
            HStack(spacing: 8) {
                Text(resolved.isEmpty ? "None chosen" : resolved)
                    .foregroundStyle(resolved.isEmpty ? AnyShapeStyle(.secondary) : AnyShapeStyle(.primary))
                Button("Choose…") { presentChooser(template) }
            }
        }
    }

    private func presentChooser(_ template: AIPluginDescriptor.ProviderTemplate) {
        guard let window = NSApp.keyWindow ?? NSApp.mainWindow else { return }
        let values = AIProviderConfigStore.configValues(for: configuration, template: template, fields: fields)
        let context = ModelChooserContext(
            pluginIdentifier: configuration.pluginIdentifier, template: template,
            baseURL: values["baseURL"] ?? "", apiKey: values["apiKey"],
            currentModel: currentModel.isEmpty ? template.resolvedDefaultModel : currentModel)
        // Presented a run-loop turn later, not inline: `present` enters `runModal`,
        // and spinning a nested modal loop from inside a SwiftUI button action —
        // i.e. from inside SwiftUI's own update — leaves the chooser's AppKit
        // controls unpainted (framed and hit-testable, but blank until something
        // forces a redraw). Off the button's call stack, the window draws normally.
        //
        // Scheduled on the run loop rather than with `DispatchQueue.main.async`:
        // the modal loop never returns from the block that starts it, and a main
        // *queue* block that never returns stops the queue draining, which strands
        // every `await` the chooser makes (live model list, sizes, blurbs) until
        // the window closes. A run-loop block leaves the main queue free to drain.
        CFRunLoopPerformBlock(CFRunLoopGetMain(), CFRunLoopMode.commonModes.rawValue) {
            MainActor.assumeIsolated {
                ModelChooser.present(over: window, context: context) { selectModel($0, template: template) }
            }
        }
        CFRunLoopWakeUp(CFRunLoopGetMain())
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
///
/// Named for the chat *test* affordance, not the `ChatSession` protocol: the
/// backend is bridged onto that protocol via `ChatBackendSession`, which keeps
/// the provider's live per-turn config while the view model drives a session.
@MainActor
final class ChatTestSession: ObservableObject {
    let provider: SingleConfigurationChatConfigProvider
    let backend: AIPluginChatBackend
    let viewModel: ChatViewModel

    init(configuration: AIProviderConfiguration, pluginManager: AIPluginManager) {
        self.provider = SingleConfigurationChatConfigProvider(
            configuration: configuration, pluginManager: pluginManager)
        self.backend = AIPluginChatBackend(pluginManager: pluginManager, configProvider: provider)
        self.viewModel = ChatViewModel(session: ChatBackendSession(backend: backend))
    }
}

/// Embeds the existing AppKit `ChatView` for a supplied `ChatViewModel`.
private struct ChatTestView: NSViewRepresentable {
    let viewModel: ChatViewModel

    func makeNSView(context: Context) -> NSView { ChatView(viewModel: viewModel) }
    func updateNSView(_ nsView: NSView, context: Context) {}
}

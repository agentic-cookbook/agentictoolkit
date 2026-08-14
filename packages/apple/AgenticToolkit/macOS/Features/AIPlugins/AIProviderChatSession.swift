import Foundation
import AIPluginKit
import AgenticToolkitCore

/// Owns the chat object graph for one provider configuration — the live config
/// provider, the plugin backend, and the view model — so a host can drive the same
/// `ChatViewModel` its transcript renders (e.g. to post model-change notices). The
/// backend holds the provider weakly, so this strong reference keeps it alive.
///
/// Named for the *provider configuration* it is pinned to, not the `ChatSession`
/// protocol: the backend is bridged onto that protocol via `ChatBackendSession`,
/// which keeps the provider's live per-turn config while the view model drives a
/// session. Values are read live, so an edit in the settings editor takes effect on
/// the next message without rebuilding this.
@MainActor
public final class AIProviderChatSession: ObservableObject {
    let provider: SingleConfigurationChatConfigProvider
    let backend: AIPluginChatBackend
    public let viewModel: ChatViewModel

    public init(configuration: AIProviderConfiguration, pluginManager: AIPluginManager) {
        self.provider = SingleConfigurationChatConfigProvider(
            configuration: configuration, pluginManager: pluginManager)
        self.backend = AIPluginChatBackend(pluginManager: pluginManager, configProvider: provider)
        self.viewModel = ChatViewModel(session: ChatBackendSession(backend: backend))
    }
}

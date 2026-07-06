import Foundation
import AIPluginKit
import AgenticToolkitCore

/// Default `ChatConfigProvider`: reports the summaries-active configuration
/// (`UserSettings.selectedAIProviderConfigurationId`) resolved to its plugin,
/// model, and values. Empty selection == no provider (the daemon's Default path).
@MainActor
public final class PluginChatConfigProvider: ChatConfigProvider {

    private let pluginManager: AIPluginManager

    public init(pluginManager: AIPluginManager) {
        self.pluginManager = pluginManager
    }

    private var resolved: AIProviderResolver.Resolved? {
        let id = UserSettings.selectedAIProviderConfigurationId.value
        guard !id.isEmpty, let uuid = UUID(uuidString: id),
              let config = UserSettings.aiProviderConfigurations.value.first(where: { $0.id == uuid })
        else { return nil }
        return AIProviderResolver.resolve(config, manager: pluginManager)
    }

    public var selectedPluginIdentifier: String { resolved?.pluginIdentifier ?? "" }
    public var selectedModel: String { resolved?.model ?? "" }
    public var pluginConfigValues: [String: String] { resolved?.values ?? [:] }
}

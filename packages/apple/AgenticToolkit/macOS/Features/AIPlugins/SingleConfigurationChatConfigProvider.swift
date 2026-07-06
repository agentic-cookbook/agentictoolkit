import Foundation
import AIPluginKit
import AgenticToolkitCore

/// A `ChatConfigProvider` pinned to one configuration, so the chat embedded in a
/// provider's editor always talks to *that* configuration regardless of the
/// summaries-active selection. Values are read live via `AIProviderResolver`, so
/// edits in the same editor take effect on the next message.
@MainActor
final class SingleConfigurationChatConfigProvider: ChatConfigProvider {

    private let configuration: AIProviderConfiguration
    private let pluginManager: AIPluginManager

    init(configuration: AIProviderConfiguration, pluginManager: AIPluginManager) {
        self.configuration = configuration
        self.pluginManager = pluginManager
    }

    private var resolved: AIProviderResolver.Resolved? {
        AIProviderResolver.resolve(configuration, manager: pluginManager)
    }

    var selectedPluginIdentifier: String { resolved?.pluginIdentifier ?? "" }
    var selectedModel: String { resolved?.model ?? "" }
    var pluginConfigValues: [String: String] { resolved?.values ?? [:] }
}

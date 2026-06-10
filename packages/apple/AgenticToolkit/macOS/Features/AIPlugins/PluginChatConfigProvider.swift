import Foundation
import AIPluginKit
import AgenticToolkitCore

/// Default `ChatConfigProvider` backed by `PluginConfigStore`: it reports the
/// globally-selected plugin and resolves that plugin's model and field values
/// from persisted settings, using `AIPluginManager`'s descriptors to find the
/// selected plugin. Hosts with no bespoke selection UI use this directly so the
/// chat backend tracks the settings the user edits in the AI settings panel.
@MainActor
public final class PluginChatConfigProvider: ChatConfigProvider {

    private let pluginManager: AIPluginManager

    public init(pluginManager: AIPluginManager) {
        self.pluginManager = pluginManager
    }

    public var selectedPluginIdentifier: String {
        PluginConfigStore.selectedPluginSetting().currentValue
    }

    public var selectedModel: String {
        guard let descriptor = selectedDescriptor else { return "" }
        return PluginConfigStore.selectedModel(for: descriptor)
    }

    public var pluginConfigValues: [String: String] {
        guard let descriptor = selectedDescriptor else { return [:] }
        return PluginConfigStore.configValues(for: descriptor)
    }

    /// The descriptor matching the currently-selected plugin, if any is selected
    /// and still discovered.
    private var selectedDescriptor: AIPluginDescriptor? {
        let identifier = selectedPluginIdentifier
        guard !identifier.isEmpty else { return nil }
        return pluginManager.descriptors.first { $0.identifier == identifier }
    }
}

import Foundation
import AIPluginKit
import AgenticToolkitCore

/// A `ChatConfigProvider` pinned to one specific plugin descriptor rather than the
/// globally-selected plugin. `PluginChatConfigProvider` reports whatever plugin the
/// user has selected app-wide; this one always reports *its* descriptor, so the
/// chat embedded in a plugin's edit panel talks to that plugin regardless of the
/// global selection. Model and field values are read live from `PluginConfigStore`
/// (secrets resolved from the Keychain), so edits in the same panel take effect on
/// the next message.
@MainActor
final class SinglePluginChatConfigProvider: ChatConfigProvider {

    private let descriptor: AIPluginDescriptor

    init(descriptor: AIPluginDescriptor) {
        self.descriptor = descriptor
    }

    var selectedPluginIdentifier: String { descriptor.identifier }

    var selectedModel: String { PluginConfigStore.selectedModel(for: descriptor) }

    var pluginConfigValues: [String: String] { PluginConfigStore.configValues(for: descriptor) }
}

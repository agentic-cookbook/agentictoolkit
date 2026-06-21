import AgenticToolkitCore
import AIPluginKit
import AgenticToolkitCoreMacOS
import AppKit

/// A settings panel generated entirely from a plugin's `AIPluginDescriptor` — no
/// plugin code runs to build it. It renders a model popup (when the plugin offers
/// more than one model) and one control per descriptor field: a secure field for
/// secrets, a plain text field otherwise. Every control binds to the shared
/// `PluginConfigStore` settings, so edits here are exactly what the chat backend
/// reads back through `pluginConfigValues`.
@MainActor
final class PluginConfigPanel: ComposableSettings.SettingsPanelViewController {

    private let pluginDescriptor: AIPluginDescriptor
    private let pluginManager: AIPluginManager

    /// Retained for the panel's lifetime so the chat backend — which holds the
    /// provider *weakly* — keeps a live source. Pinned to this panel's descriptor,
    /// so the embedded chat always talks to *this* plugin regardless of the
    /// app-wide selection.
    private let chatConfigProvider: SinglePluginChatConfigProvider

    init(descriptor: AIPluginDescriptor, pluginManager: AIPluginManager) {
        self.pluginDescriptor = descriptor
        self.pluginManager = pluginManager
        self.chatConfigProvider = SinglePluginChatConfigProvider(descriptor: descriptor)
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: descriptor.displayName,
            icon: NSImage(systemSymbolName: "cpu", accessibilityDescription: nil)
        ))
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let group = ComposableSettings.GroupView(withTitle: pluginDescriptor.displayName)

        if pluginDescriptor.models.count > 1 {
            group.addSettingSubview(makeModelPopup())
        }

        for field in pluginDescriptor.fields {
            group.addSettingSubview(makeFieldView(for: field))
        }

        addGroup(group)
        addChatView(below: group)
    }

    /// Embeds a live chat with this plugin beneath the config controls. Its top is
    /// pinned a padding below the last config group; its bottom is pinned to the
    /// panel's bottom — which the split controller pins to the window — so the chat
    /// fills the remaining height and grows with the window.
    private func addChatView(below group: NSView) {
        // Capture @MainActor reference types; read their properties live per-turn
        // inside MainActor.run so the session always sees the current config.
        let pluginManager = self.pluginManager
        let chatConfigProvider = self.chatConfigProvider

        let session = LocalChatSession(
            resolvePlugin: {
                await MainActor.run {
                    try? pluginManager.loadPlugin(identifier: chatConfigProvider.selectedPluginIdentifier)
                }
            },
            makeContext: { history in
                await MainActor.run {
                    AIChatContext(
                        messages: history,
                        model: chatConfigProvider.selectedModel,
                        systemPrompt: nil,
                        tools: [],
                        config: AIPluginConfig(chatConfigProvider.pluginConfigValues)
                    )
                }
            }
        )
        let chatView = ChatView(viewModel: ChatViewModel(session: session))
        chatView.translatesAutoresizingMaskIntoConstraints = false
        settingsView.addSubview(chatView)

        NSLayoutConstraint.activate([
            chatView.topAnchor.constraint(equalTo: group.bottomAnchor, constant: 16),
            chatView.leadingAnchor.constraint(equalTo: settingsView.leadingAnchor),
            chatView.trailingAnchor.constraint(equalTo: settingsView.trailingAnchor),
            chatView.bottomAnchor.constraint(equalTo: settingsView.bottomAnchor)
        ])
    }

    private func makeModelPopup() -> NSView {
        let viewModel = ComposableSettings.ChoiceViewModel(
            title: "Model",
            setting: PluginConfigStore.modelSetting(for: pluginDescriptor),
            choices: pluginDescriptor.models.map { .init(label: $0, value: $0) }
        )
        return ComposableSettings.PopupMenuChoiceView(viewModel: viewModel)
    }

    private func makeFieldView(for field: AIPluginDescriptor.Field) -> NSView {
        let viewModel = ComposableSettings.ViewModel(
            title: field.label,
            setting: PluginConfigStore.fieldSetting(plugin: pluginDescriptor.identifier, field: field)
        )
        return field.isSecret
            ? ComposableSettings.SecureTextEditView(with: viewModel)
            : ComposableSettings.TextEditView(with: viewModel)
    }
}

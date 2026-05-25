import AgenticToolkitCore
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

    init(descriptor: AIPluginDescriptor) {
        self.pluginDescriptor = descriptor
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

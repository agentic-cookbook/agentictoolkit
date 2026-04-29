import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `ClaudeLocalPlugin`. Composable: model popup only;
/// the local CLI doesn't take an API key.
@MainActor
final class ClaudeLocalSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    private let plugin: ClaudeLocalPlugin

    init(plugin: ClaudeLocalPlugin) {
        self.plugin = plugin
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Claude (Local)",
            icon: NSImage(systemSymbolName: "terminal", accessibilityDescription: nil)
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        settingsView.addGroup(makeModelGroup())
    }

    private func makeModelGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Model")
        let viewModel = ComposableSettings.ChoiceViewModel<String>(
            title: "Model",
            setting: UserSettings.claudeLocalModel,
            choices: plugin.availableModels.map { .init(label: $0, value: $0) }
        )
        group.addArrangedSubview(ComposableSettings.PopupMenuChoiceView(viewModel: viewModel))
        group.addArrangedSubview(ComposableSettings.ExplanationView(
            withText: "Routes through the local Claude CLI. No API key required."
        ))
        return group
    }
}

extension UserSettings {
    public static var claudeLocalModel = UserSetting<String>(
        "ai_model_\(ClaudeLocalPlugin.identifier)",
        default: ""
    )
}

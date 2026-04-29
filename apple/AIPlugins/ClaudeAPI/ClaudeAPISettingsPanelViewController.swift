import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `ClaudeAPIPlugin`. Composable: model popup, masked
/// API-key entry, async-test + clear actions.
@MainActor
final class ClaudeAPISettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    private let plugin: ClaudeAPIPlugin
    private let statusLabel = NSTextField(labelWithString: "")

    init(plugin: ClaudeAPIPlugin) {
        self.plugin = plugin
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Claude (API)",
            icon: NSImage(systemSymbolName: "brain", accessibilityDescription: nil)
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        settingsView.addGroup(makeModelGroup())
        settingsView.addGroup(makeCredentialsGroup())
    }

    private func makeModelGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Model")
        let viewModel = ComposableSettings.ChoiceViewModel<String>(
            title: "Model",
            setting: UserSettings.claudeAPIModel,
            choices: plugin.availableModels.map { .init(label: $0, value: $0) }
        )
        group.addArrangedSubview(ComposableSettings.PopupMenuChoiceView(viewModel: viewModel))
        return group
    }

    private func makeCredentialsGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "API Key")

        group.addArrangedSubview(ComposableSettings.SecureTextEditView(
            with: ComposableSettings.ViewModel<String>(
                title: "API Key",
                setting: UserSettings.claudeAPIKey
            )
        ))

        let buttonRow = ComposableSettings.HorizontalStackView()
        buttonRow.addArrangedSubview(ComposableSettings.ButtonView(viewModel: ComposableSettings.ButtonViewModel(
            title: "Test API Key",
            wasPressedCallback: { [weak self] in self?.runTest() }
        )))
        buttonRow.addArrangedSubview(ComposableSettings.ButtonView(viewModel: ComposableSettings.ButtonViewModel(
            title: "Clear Key",
            wasPressedCallback: { UserSettings.claudeAPIKey.remove() }
        )))
        group.addArrangedSubview(buttonRow)

        statusLabel.font = .systemFont(ofSize: 11)
        statusLabel.textColor = .secondaryLabelColor
        group.addArrangedSubview(statusLabel)

        return group
    }

    private func runTest() {
        let key = UserSettings.claudeAPIKey.value
        guard !key.isEmpty else {
            statusLabel.stringValue = "No API key entered"
            statusLabel.textColor = .systemRed
            return
        }
        statusLabel.stringValue = "Testing…"
        statusLabel.textColor = .secondaryLabelColor
        let plugin = self.plugin
        let credentials = AIPluginCredentials(apiKey: key)
        Task { [weak self] in
            let error = await plugin.validateCredentials(credentials)
            await MainActor.run {
                guard let self else { return }
                if let error {
                    self.statusLabel.stringValue = error
                    self.statusLabel.textColor = .systemRed
                } else {
                    self.statusLabel.stringValue = "API key is valid"
                    self.statusLabel.textColor = .systemGreen
                }
            }
        }
    }
}

extension UserSettings {
    public static var claudeAPIKey = UserSetting<String>(
        "api_key_\(ClaudeAPIPlugin.identifier)",
        default: "",
        isSecure: true
    )
    public static var claudeAPIModel = UserSetting<String>(
        "ai_model_\(ClaudeAPIPlugin.identifier)",
        default: ""
    )
}

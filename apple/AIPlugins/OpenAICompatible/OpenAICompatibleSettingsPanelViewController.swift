import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `OpenAICompatiblePlugin`. Composable: free-form
/// model name, base-URL override, masked API-key entry, async-test +
/// clear actions.
@MainActor
final class OpenAICompatibleSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    private let plugin: OpenAICompatiblePlugin
    private let statusLabel = NSTextField(labelWithString: "")

    init(plugin: OpenAICompatiblePlugin) {
        self.plugin = plugin
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Custom (OpenAI-compatible)",
            icon: NSImage(systemSymbolName: "server.rack", accessibilityDescription: nil)
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        settingsView.addGroup(makeEndpointGroup())
        settingsView.addGroup(makeCredentialsGroup())
    }

    private func makeEndpointGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Endpoint")

        group.addArrangedSubview(ComposableSettings.TextEditView(
            with: ComposableSettings.ViewModel<String>(
                title: "Base URL",
                setting: UserSettings.openAICompatibleBaseURL
            )
        ))

        group.addArrangedSubview(ComposableSettings.TextEditView(
            with: ComposableSettings.ViewModel<String>(
                title: "Model",
                setting: UserSettings.openAICompatibleModel
            )
        ))

        group.addArrangedSubview(ComposableSettings.ExplanationView(
            withText: "Point at any OpenAI-compatible endpoint (e.g. a local server). Enter the model name your endpoint expects."
        ))

        return group
    }

    private func makeCredentialsGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "API Key")

        group.addArrangedSubview(ComposableSettings.SecureTextEditView(
            with: ComposableSettings.ViewModel<String>(
                title: "API Key",
                setting: UserSettings.openAICompatibleAPIKey
            )
        ))

        let buttonRow = ComposableSettings.HorizontalStackView()
        buttonRow.addArrangedSubview(ComposableSettings.ButtonView(viewModel: ComposableSettings.ButtonViewModel(
            title: "Test API Key",
            wasPressedCallback: { [weak self] in self?.runTest() }
        )))
        buttonRow.addArrangedSubview(ComposableSettings.ButtonView(viewModel: ComposableSettings.ButtonViewModel(
            title: "Clear Key",
            wasPressedCallback: { UserSettings.openAICompatibleAPIKey.remove() }
        )))
        group.addArrangedSubview(buttonRow)

        statusLabel.font = .systemFont(ofSize: 11)
        statusLabel.textColor = .secondaryLabelColor
        group.addArrangedSubview(statusLabel)

        return group
    }

    private func runTest() {
        let key = UserSettings.openAICompatibleAPIKey.value
        guard !key.isEmpty else {
            statusLabel.stringValue = "No API key entered"
            statusLabel.textColor = .systemRed
            return
        }
        let baseURL = UserSettings.openAICompatibleBaseURL.value.trimmingCharacters(in: .whitespacesAndNewlines)
        statusLabel.stringValue = "Testing…"
        statusLabel.textColor = .secondaryLabelColor
        let plugin = self.plugin
        let credentials = AIPluginCredentials(apiKey: key, baseURL: baseURL.isEmpty ? nil : baseURL)
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
    public static var openAICompatibleAPIKey = UserSetting<String>(
        "api_key_\(OpenAICompatiblePlugin.identifier)",
        default: "",
        isSecure: true
    )
    public static var openAICompatibleModel = UserSetting<String>(
        "ai_model_\(OpenAICompatiblePlugin.identifier)",
        default: ""
    )
    public static var openAICompatibleBaseURL = UserSetting<String>(
        "ai_base_url_\(OpenAICompatiblePlugin.identifier)",
        default: ""
    )
}

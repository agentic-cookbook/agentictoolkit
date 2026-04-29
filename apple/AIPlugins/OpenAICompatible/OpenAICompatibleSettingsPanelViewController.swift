import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `OpenAICompatiblePlugin`. Adds a free-form Base
/// URL field and free-form Model field on top of the standard
/// API-key flow — the OpenAI-compatible plugin has no preset model list.
@MainActor
final class OpenAICompatibleSettingsPanelViewController: PluginSettingsPanel {

    init(plugin: OpenAICompatiblePlugin) {
        super.init(
            plugin: plugin,
            title: "Custom (OpenAI-compatible)",
            icon: NSImage(systemSymbolName: "server.rack", accessibilityDescription: nil)
        )
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        settingsView.addGroup(makeEndpointGroup())
        settingsView.addGroup(makeCredentialsGroup(
            apiKey: UserSettings.openAICompatibleAPIKey,
            baseURL: UserSettings.openAICompatibleBaseURL
        ))
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

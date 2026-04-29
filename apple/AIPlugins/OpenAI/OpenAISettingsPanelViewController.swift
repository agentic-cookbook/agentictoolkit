import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `OpenAIPlugin`.
@MainActor
final class OpenAISettingsPanelViewController: PluginSettingsPanel {

    init(plugin: OpenAIPlugin) {
        super.init(
            plugin: plugin,
            title: "OpenAI (ChatGPT)",
            icon: NSImage(systemSymbolName: "sparkle", accessibilityDescription: nil)
        )
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if let modelGroup = makeModelGroup(setting: UserSettings.openAIModel) {
            settingsView.addGroup(modelGroup)
        }
        settingsView.addGroup(makeCredentialsGroup(apiKey: UserSettings.openAIAPIKey))
    }
}

extension UserSettings {
    public static var openAIAPIKey = UserSetting<String>(
        "api_key_\(OpenAIPlugin.identifier)",
        default: "",
        isSecure: true
    )
    public static var openAIModel = UserSetting<String>(
        "ai_model_\(OpenAIPlugin.identifier)",
        default: ""
    )
}

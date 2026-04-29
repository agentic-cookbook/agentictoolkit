import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS
import AIPluginsShared

/// Settings panel for `ClaudeAPIPlugin`.
@MainActor
final class ClaudeAPISettingsPanelViewController: PluginSettingsPanel {

    init(plugin: ClaudeAPIPlugin) {
        super.init(
            plugin: plugin,
            title: "Claude (API)",
            icon: NSImage(systemSymbolName: "brain", accessibilityDescription: nil)
        )
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if let modelGroup = makeModelGroup(setting: UserSettings.claudeAPIModel) {
            settingsView.addGroup(modelGroup)
        }
        settingsView.addGroup(makeCredentialsGroup(apiKey: UserSettings.claudeAPIKey))
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

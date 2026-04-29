import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `GooglePlugin`.
@MainActor
final class GoogleSettingsPanelViewController: PluginSettingsPanel {

    init(plugin: GooglePlugin) {
        super.init(
            plugin: plugin,
            title: "Google (Gemini)",
            icon: NSImage(systemSymbolName: "g.circle", accessibilityDescription: nil)
        )
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if let modelGroup = makeModelGroup(setting: UserSettings.googleModel) {
            settingsView.addGroup(modelGroup)
        }
        settingsView.addGroup(makeCredentialsGroup(apiKey: UserSettings.googleAPIKey))
    }
}

extension UserSettings {
    public static var googleAPIKey = UserSetting<String>(
        "api_key_\(GooglePlugin.identifier)",
        default: "",
        isSecure: true
    )
    public static var googleModel = UserSetting<String>(
        "ai_model_\(GooglePlugin.identifier)",
        default: ""
    )
}

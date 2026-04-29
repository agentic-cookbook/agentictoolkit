import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Settings panel for `ClaudeLocalPlugin`. The local CLI doesn't take an
/// API key, so the panel is just a model popup + an explanation.
@MainActor
final class ClaudeLocalSettingsPanelViewController: PluginSettingsPanel {

    init(plugin: ClaudeLocalPlugin) {
        super.init(
            plugin: plugin,
            title: "Claude (Local)",
            icon: NSImage(systemSymbolName: "terminal", accessibilityDescription: nil)
        )
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        if let modelGroup = makeModelGroup(setting: UserSettings.claudeLocalModel) {
            modelGroup.addArrangedSubview(ComposableSettings.ExplanationView(
                withText: "Routes through the local Claude CLI. No API key required."
            ))
            settingsView.addGroup(modelGroup)
        }
    }
}

extension UserSettings {
    public static var claudeLocalModel = UserSetting<String>(
        "ai_model_\(ClaudeLocalPlugin.identifier)",
        default: ""
    )
}

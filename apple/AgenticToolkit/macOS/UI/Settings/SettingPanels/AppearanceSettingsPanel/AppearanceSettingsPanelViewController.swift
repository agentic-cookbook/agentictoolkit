import AppKit
import AgenticToolkitCore

/// Reusable Settings panel offering a theme picker and a text-size slider.
/// Reads/writes via `UserSettings.appearanceMode` and `UserSettings.textSize`;
/// system integration (applying `NSApp.appearance`, propagating text size)
/// is wired up by the host.
@MainActor
public final class AppearanceSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public override func viewDidLoad() {
        super.viewDidLoad()

        self.descriptor.title = "Appearance"
        self.descriptor.icon = NSImage(systemSymbolName: "paintbrush", accessibilityDescription: nil)

        self.settingsView.addGroup(createAppearanceGroup())
        self.settingsView.addGroup(createTextSizeGroup())
    }

    func createAppearanceGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Appearance")

        let viewModel = ComposableSettings.ChoiceViewModel<String>(
            title: "Theme",
            setting: UserSettings.appearanceMode,
            choices: AppearanceMode.allCases.map {
                .init(label: $0.label, value: $0.rawValue)
            }
        )
        group.addArrangedSubview(ComposableSettings.PopupMenuChoiceView(viewModel: viewModel))

        return group
    }

    func createTextSizeGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Text Size")

        let viewModel = ComposableSettings.RangeViewModel<Double>(
            title: "Size",
            setting: UserSettings.textSize,
            minValue: -4.0,
            maxValue: 4.0
        )
        group.addArrangedSubview(ComposableSettings.SliderView(viewModel: viewModel))

        return group
    }
}

extension UserSettings {
    
    /// Whether the session panel floats above all other windows.
    static public var alwaysOnTop = UserSetting<Bool>("always_on_top", default: true)
    
    /// Whether the dock icon is visible.
    static public var showDockIcon = UserSetting<Bool>("show_dock_icon", default: false)
    
    /// Appearance mode: "light" / "dark" / "auto".
    static public var appearanceMode = UserSetting<String>("appearance_mode", default: "auto")
    
    /// Text size offset from system default (range -4...4).
    static public var textSize = UserSetting<Double>("text_size", default: 0.0)
}


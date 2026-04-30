import AppKit
import AgenticToolkitCore

/// Reusable Settings panel offering a theme picker and a text-size slider.
/// Reads/writes via `UserSettings.appearanceMode` and `UserSettings.textSize`;
/// system integration (applying `NSApp.appearance`, propagating text size)
/// is wired up by the host.
@MainActor
public final class AppearanceSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Appearance",
            icon: NSImage(systemSymbolName: "paintbrush", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        self.settingsView.addGroup(createAppearanceGroup())
        self.settingsView.addGroup(createTextSizeGroup())
    }

    func createAppearanceGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Appearance")

        let viewModel = ComposableSettings.ChoiceViewModel<AppearanceMode>(
            title: "Theme",
            setting: UserSettings.appearanceMode,
            choices: AppearanceMode.allCases.map {
                .init(label: $0.label, value: $0)
            }
        )
        group.addSettingSubview(ComposableSettings.PopupMenuChoiceView(viewModel: viewModel))

        return group
    }

    func createTextSizeGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Text Size")

        let viewModel = ComposableSettings.ChoiceViewModel<TextSize>(
            title: "Size",
            setting: UserSettings.textSize,
            choices: TextSize.allCases.map { .init(label: $0.label, value: $0) }
        )
        group.addSettingSubview(ComposableSettings.ChoiceSliderView(viewModel: viewModel))

        return group
    }
}

public enum AppearanceMode: String, CaseIterable, Sendable, Codable {
    case auto = "auto"
    case light = "light"
    case dark = "dark"

    public var label: String {
        switch self {
        case .auto:  return "Auto"
        case .light: return "Light"
        case .dark:  return "Dark"
        }
    }

    /// `nil` means "follow the system" — assign to `NSApp.appearance` to clear
    /// any prior override.
    public var nsAppearance: NSAppearance? {
        switch self {
        case .auto:  return nil
        case .light: return NSAppearance(named: .aqua)
        case .dark:  return NSAppearance(named: .darkAqua)
        }
    }
}

/// Discrete text-size scale exposed by `OldAppearanceSettingsPanelViewController`.
///
/// Apps decide how to map this to actual font sizes (point sizes, dynamic
/// type categories, multipliers) — this type just tracks the user's choice.
public enum TextSize: String, CaseIterable, Sendable, Codable, Equatable {
    case xSmall, small, medium, large, xLarge, xxLarge, xxxLarge

    public var label: String {
        switch self {
        case .xSmall:   return "Extra Small"
        case .small:    return "Small"
        case .medium:   return "Medium"
        case .large:    return "Large"
        case .xLarge:   return "Extra Large"
        case .xxLarge:  return "XX Large"
        case .xxxLarge: return "XXX Large"
        }
    }
}

extension UserSettings {

    /// Whether the dock icon is visible.
    static public var showDockIcon = UserSetting<Bool>("show_dock_icon", default: false)

    /// Appearance mode: "light" / "dark" / "auto".
    static public var appearanceMode = UserSetting<AppearanceMode>("appearance_mode", default: .auto)

    /// Discrete text-size scale (xSmall…xxxLarge).
    static public var textSize = UserSetting<TextSize>("text_size", default: .medium)
}

import AppKit

/// Theme preference exposed by `AppearanceSettingsPanelViewController`.
///
/// The raw value is the string written to `UserDefaults` so apps can read it
/// back without depending on this type.
public enum AppearanceMode: String, CaseIterable, Sendable {
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

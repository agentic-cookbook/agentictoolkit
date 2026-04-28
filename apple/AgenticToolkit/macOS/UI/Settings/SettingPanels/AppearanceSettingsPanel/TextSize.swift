import Foundation

/// Discrete text-size scale exposed by `OldAppearanceSettingsPanelViewController`.
///
/// Apps decide how to map this to actual font sizes (point sizes, dynamic
/// type categories, multipliers) — this type just tracks the user's choice.
public enum TextSize: String, CaseIterable, Sendable {
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

import Foundation

/// App-wide semantic color roles. UI reads colors by *role*, never by raw ANSI
/// slot, so a control's meaning ("primary text", "accent") survives any theme
/// swap. A 16-color terminal scheme maps onto these via `SemanticPalette`.
public enum ThemeRole: String, CaseIterable, Sendable {
    /// Base window / app backdrop.
    case windowBackground
    /// Slightly elevated panel/content surface above the window backdrop.
    case surface
    /// Primary, high-emphasis text.
    case primaryText
    /// Secondary, medium-emphasis text (subtitles, captions).
    case secondaryText
    /// Tertiary, low-emphasis text (placeholders, "no data").
    case tertiaryText
    /// Primary accent (links, selected controls, key data series).
    case accent
    /// Success / active / positive state.
    case success
    /// Warning / caution state.
    case warning
    /// Error / destructive / negative state.
    case danger
    /// Informational / neutral-highlight state.
    case info
    /// Hairline borders and dividers.
    case border
    /// Selection / highlight fill.
    case selection
    /// Text drawn on top of a `selection` fill.
    case selectionText
    /// Text-insertion cursor.
    case cursor
}

/// Resolves every `ThemeRole` to a concrete `RGBAColor` for a given `ColorTheme`.
///
/// Resolution order per role: an explicit `ColorTheme.roleOverrides` entry wins;
/// otherwise the color is *derived* from the terminal palette by the default
/// mapping below (bg→window, fg→primary text, ANSI accents→semantic accents, and
/// luminance blends for surfaces/secondary text/borders). This is what lets a
/// plain terminal scheme drive app-wide chrome.
public struct SemanticPalette: Equatable, Sendable {
    public let theme: ColorTheme

    public init(theme: ColorTheme) {
        self.theme = theme
    }

    /// The resolved color for `role` (override if present, else derived).
    public func color(_ role: ThemeRole) -> RGBAColor {
        if let override = theme.roleOverrides[role.rawValue] {
            return override
        }
        return derived(role)
    }

    /// The default palette-derived color for `role`, ignoring overrides.
    public func derived(_ role: ThemeRole) -> RGBAColor {
        switch role {
        case .windowBackground:
            return theme.background
        case .surface:
            return theme.background.blended(withFraction: 0.08, of: theme.foreground)
        case .primaryText:
            return theme.foreground
        case .secondaryText:
            return theme.foreground.blended(withFraction: 0.35, of: theme.background)
        case .tertiaryText:
            return theme.foreground.blended(withFraction: 0.60, of: theme.background)
        case .accent:
            return theme.ansiColor(at: 4) ?? theme.foreground
        case .success:
            return theme.ansiColor(at: 2) ?? theme.foreground
        case .warning:
            return theme.ansiColor(at: 3) ?? theme.foreground
        case .danger:
            return theme.ansiColor(at: 1) ?? theme.foreground
        case .info:
            return theme.ansiColor(at: 6) ?? theme.foreground
        case .border:
            return theme.background.blended(withFraction: 0.18, of: theme.foreground)
        case .selection:
            return theme.selection
        case .selectionText:
            return theme.foreground
        case .cursor:
            return theme.cursor
        }
    }
}

extension SemanticPalette {
    public var windowBackground: RGBAColor { color(.windowBackground) }
    public var surface: RGBAColor { color(.surface) }
    public var primaryText: RGBAColor { color(.primaryText) }
    public var secondaryText: RGBAColor { color(.secondaryText) }
    public var tertiaryText: RGBAColor { color(.tertiaryText) }
    public var accent: RGBAColor { color(.accent) }
    public var success: RGBAColor { color(.success) }
    public var warning: RGBAColor { color(.warning) }
    public var danger: RGBAColor { color(.danger) }
    public var info: RGBAColor { color(.info) }
    public var border: RGBAColor { color(.border) }
    public var selection: RGBAColor { color(.selection) }
    public var selectionText: RGBAColor { color(.selectionText) }
    public var cursor: RGBAColor { color(.cursor) }
}

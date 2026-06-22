import Foundation

/// App-wide semantic color roles. UI reads colors by *role*, never by raw ANSI
/// slot, so a control's meaning ("primary text", "accent") survives any theme
/// swap. A 16-color terminal scheme maps onto these via `SemanticPalette`.
public enum ThemeRole: String, CaseIterable, Sendable {
    // Backgrounds (lowest → highest elevation)
    /// Base window / app backdrop.
    case windowBackground
    /// Panel / card surface elevated above the window backdrop.
    case surface
    /// Strongly elevated surface (HUD, popover, floating panel).
    case elevatedSurface
    /// Background of editable controls (text fields, wells, list rows).
    case controlBackground

    // Text (highest → lowest emphasis)
    /// Primary, high-emphasis text.
    case primaryText
    /// Secondary, medium-emphasis text (subtitles, captions).
    case secondaryText
    /// Tertiary, low-emphasis text ("no data", disabled).
    case tertiaryText
    /// Placeholder / hint text in empty fields.
    case placeholderText
    /// Text/icons drawn on top of an `accent` fill (auto-contrasted).
    case onAccentText

    // Status / accents
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

    // Lines
    /// Hairline borders / separators.
    case border
    /// Stronger stroke for box outlines and focus rings.
    case outline
    /// Subtle divider, fainter than `border`.
    case divider

    // Selection / caret
    /// Selection / highlight fill.
    case selection
    /// Text drawn on top of a `selection` fill (auto-contrasted).
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

    /// Every role resolved once at construction (override-or-derived), so repeated
    /// `color(_:)` lookups are O(1) dictionary reads. Resolving `secondaryText` /
    /// `tertiaryText` / `placeholderText` runs the iterative `dimmed()` contrast
    /// loop (pow-heavy); doing it per access in cell/draw/applyTheme paths is
    /// wasteful, so we pay it once per palette instance. Derived purely from
    /// `theme`, so it never breaks `Equatable`.
    private let resolved: [ThemeRole: RGBAColor]

    public init(theme: ColorTheme) {
        self.theme = theme
        var map: [ThemeRole: RGBAColor] = [:]
        map.reserveCapacity(ThemeRole.allCases.count)
        for role in ThemeRole.allCases {
            map[role] = Self.resolve(role, theme: theme)
        }
        self.resolved = map
    }

    /// The resolved color for `role` (override if present, else derived).
    public func color(_ role: ThemeRole) -> RGBAColor {
        resolved[role] ?? Self.resolve(role, theme: theme)
    }

    /// The default palette-derived color for `role`, ignoring overrides.
    ///
    /// Backgrounds layer toward the foreground (so panels read above the window
    /// on both dark and light themes). Secondary/tertiary/placeholder text dim
    /// toward the backdrop but are held above legibility floors so even a
    /// low-contrast imported scheme stays readable. `onAccentText`/`selectionText`
    /// auto-pick black or white for contrast on their fills.
    public func derived(_ role: ThemeRole) -> RGBAColor {
        Self.derive(role, theme: theme)
    }

    /// Override-or-derived resolution for a single role.
    private static func resolve(_ role: ThemeRole, theme: ColorTheme) -> RGBAColor {
        theme.roleOverrides[role.rawValue] ?? derive(role, theme: theme)
    }

    private static func derive(_ role: ThemeRole, theme: ColorTheme) -> RGBAColor {
        let background = theme.background
        let foreground = theme.foreground
        switch role {
        case .windowBackground:
            return background
        case .surface:
            return background.blended(withFraction: 0.06, of: foreground)
        case .elevatedSurface:
            return background.blended(withFraction: 0.12, of: foreground)
        case .controlBackground:
            return background.blended(withFraction: 0.09, of: foreground)
        case .primaryText:
            return foreground
        case .secondaryText:
            return foreground.dimmed(towards: background, by: 0.32, minContrast: 3.0)
        case .tertiaryText:
            return foreground.dimmed(towards: background, by: 0.55, minContrast: 2.0)
        case .placeholderText:
            return foreground.dimmed(towards: background, by: 0.68, minContrast: 1.6)
        case .onAccentText:
            return derive(.accent, theme: theme).bestTextColor()
        case .accent:
            return theme.ansiColor(at: 4) ?? foreground
        case .success:
            return theme.ansiColor(at: 2) ?? foreground
        case .warning:
            return theme.ansiColor(at: 3) ?? foreground
        case .danger:
            return theme.ansiColor(at: 1) ?? foreground
        case .info:
            return theme.ansiColor(at: 6) ?? foreground
        case .border:
            return background.blended(withFraction: 0.18, of: foreground)
        case .outline:
            return background.blended(withFraction: 0.30, of: foreground)
        case .divider:
            return background.blended(withFraction: 0.10, of: foreground)
        case .selection:
            return theme.selection
        case .selectionText:
            return theme.selection.bestTextColor()
        case .cursor:
            return theme.cursor
        }
    }

    /// An ordered list of visually distinct series colors for charts, guaranteed
    /// non-empty and to contrast against `surface` so no series collapses into
    /// the backdrop. The terminal "black"/"white" ANSI slots (0, 7, 8, 15) — which
    /// sit ~on the background on most themes — are deliberately excluded: leading
    /// with semantic accents, then the bright ANSI hues for additional variety.
    public var chartSeriesColors: [RGBAColor] {
        let surface = color(.surface)
        let semantic = [color(.accent), color(.success), color(.info), color(.warning), color(.danger)]
        let brights = [9, 10, 11, 12, 13, 14].compactMap { theme.ansiColor(at: $0) }
        let visible = (semantic + brights).filter { $0.contrastRatio(against: surface) >= 1.5 }
        return visible.isEmpty ? semantic : visible
    }
}

extension SemanticPalette {
    public var windowBackground: RGBAColor { color(.windowBackground) }
    public var surface: RGBAColor { color(.surface) }
    public var elevatedSurface: RGBAColor { color(.elevatedSurface) }
    public var controlBackground: RGBAColor { color(.controlBackground) }
    public var primaryText: RGBAColor { color(.primaryText) }
    public var secondaryText: RGBAColor { color(.secondaryText) }
    public var tertiaryText: RGBAColor { color(.tertiaryText) }
    public var placeholderText: RGBAColor { color(.placeholderText) }
    public var onAccentText: RGBAColor { color(.onAccentText) }
    public var accent: RGBAColor { color(.accent) }
    public var success: RGBAColor { color(.success) }
    public var warning: RGBAColor { color(.warning) }
    public var danger: RGBAColor { color(.danger) }
    public var info: RGBAColor { color(.info) }
    public var border: RGBAColor { color(.border) }
    public var outline: RGBAColor { color(.outline) }
    public var divider: RGBAColor { color(.divider) }
    public var selection: RGBAColor { color(.selection) }
    public var selectionText: RGBAColor { color(.selectionText) }
    public var cursor: RGBAColor { color(.cursor) }
}

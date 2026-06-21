import Foundation

/// A text role — *what kind* of text this is, independent of any theme. UI reads
/// fonts by role (like it reads colors by `ThemeRole`), so a label's meaning
/// ("title", "body", "code") survives a theme swap and a global size change.
public enum TextRole: String, CaseIterable, Sendable {
    /// Large window / screen titles.
    case title
    /// Section / group headers.
    case heading
    /// Default body text.
    case body
    /// Small, secondary text (captions, hints, "no data").
    case caption
    /// Monospaced text (numeric columns, code, identifiers).
    case code
    /// Control labels (buttons, segmented controls).
    case button
}

/// A theme-portable font weight. Bridged to `NSFont.Weight` in CoreMacOS so the
/// Core model stays Foundation-only.
public enum FontWeight: String, Codable, CaseIterable, Sendable {
    case ultraLight, thin, light, regular, medium, semibold, bold, heavy, black
}

/// One concrete text style: an optional custom family (`nil` = the system font),
/// a base point size, a weight, and whether it renders monospaced.
public struct FontStyle: Codable, Equatable, Sendable {
    /// Font family name (e.g. "Menlo", "Avenir Next"); `nil` uses the system font.
    public var family: String?
    /// Base point size, *before* the theme's global `sizeScale` is applied.
    public var size: Double
    public var weight: FontWeight
    /// When true, resolve to a monospaced font (digits + glyphs fixed-width).
    public var monospaced: Bool

    public init(
        family: String? = nil,
        size: Double,
        weight: FontWeight = .regular,
        monospaced: Bool = false
    ) {
        self.family = family
        self.size = size
        self.weight = weight
        self.monospaced = monospaced
    }
}

/// The typography half of a theme: a `FontStyle` per `TextRole` plus a global
/// `sizeScale` that multiplies every role's size at once (so a user can make the
/// whole app larger/smaller without editing each role).
///
/// `styles` is keyed by `TextRole.rawValue` (like `ColorTheme.roleOverrides`) so
/// it round-trips cleanly through Codable/`UserDefaults`. Any role absent from
/// `styles` falls back to `defaultStyle(_:)` — so the empty `ThemeTypography()`
/// reproduces the app's current system-font look exactly.
public struct ThemeTypography: Codable, Equatable, Sendable {
    /// Global multiplier applied to every role's base size (1.0 = unchanged).
    public var sizeScale: Double
    /// Per-role overrides keyed by `TextRole.rawValue`.
    public var styles: [String: FontStyle]

    public init(sizeScale: Double = 1.0, styles: [String: FontStyle] = [:]) {
        self.sizeScale = sizeScale
        self.styles = styles
    }

    /// The style for `role` — an explicit override if present, else the default.
    public func style(_ role: TextRole) -> FontStyle {
        styles[role.rawValue] ?? Self.defaultStyle(role)
    }

    /// The effective point size for `role`: its style size times `sizeScale`.
    public func size(_ role: TextRole) -> Double {
        style(role).size * sizeScale
    }

    /// The system-font default for `role`. These sizes mirror AppKit's standard
    /// metrics so an uncustomized theme looks like the app does today.
    public static func defaultStyle(_ role: TextRole) -> FontStyle {
        switch role {
        case .title:   return FontStyle(size: 22, weight: .semibold)
        case .heading: return FontStyle(size: 15, weight: .semibold)
        case .body:    return FontStyle(size: 13, weight: .regular)
        case .caption: return FontStyle(size: 11, weight: .regular)
        case .code:    return FontStyle(size: 12, weight: .regular, monospaced: true)
        case .button:  return FontStyle(size: 13, weight: .medium)
        }
    }

    /// The default system typography (all roles at their system defaults).
    public static let system = ThemeTypography()
}

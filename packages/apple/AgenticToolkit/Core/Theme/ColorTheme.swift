import Foundation

/// Whether a theme is intended for a dark or light backdrop (or follows the
/// system). Mirrors the terminal feature's `TerminalSessionProfileAppearance`
/// so a `ColorTheme` is a strict superset of a terminal profile's appearance.
public enum ThemeAppearance: String, Codable, CaseIterable, Identifiable, Sendable {
    case dark
    case light
    case auto

    public var id: String { rawValue }
}

/// A color theme: the canonical, app-wide representation of a color scheme.
///
/// It is a **superset of the terminal color palette** — it carries everything a
/// terminal needs (`foreground`, `background`, `cursor`, `selection`, and the 16
/// `ansi` colors) plus identity/metadata and optional explicit overrides for the
/// app-wide semantic roles (see `ThemeRole`). A `.itermcolors` file maps directly
/// onto the palette portion; semantic roles are derived from it unless overridden.
///
/// Colors are stored as `RGBAColor` so the whole theme round-trips cleanly through
/// `UserDefaults` (each color encodes as `#RRGGBBAA`).
public struct ColorTheme: Codable, Identifiable, Equatable, Sendable {
    /// Stable identifier. Built-ins use fixed UUID strings; imported/custom
    /// themes get a fresh UUID string.
    public var id: String
    public var name: String
    public var appearance: ThemeAppearance
    /// Built-ins are read-only in the UI (duplicate to edit). Imported/custom
    /// themes are editable and deletable.
    public var isBuiltIn: Bool

    // MARK: Terminal palette (superset of TerminalSessionColorPalette)

    /// Default text color.
    public var foreground: RGBAColor
    /// Default backdrop color.
    public var background: RGBAColor
    /// Cursor color.
    public var cursor: RGBAColor
    /// Selection highlight color.
    public var selection: RGBAColor
    /// The 16 ANSI colors (indices 0–15): 0–7 normal, 8–15 bright.
    public var ansi: [RGBAColor]

    // MARK: Semantic overrides

    /// Optional explicit colors for app-wide semantic roles, keyed by
    /// `ThemeRole.rawValue`. Any role absent here is derived from the palette
    /// by `SemanticPalette`. Overrides always win over the derived value.
    public var roleOverrides: [String: RGBAColor]

    // MARK: Typography

    /// Fonts (per `TextRole`) + a global size scale. Defaults to the system
    /// typography so existing/imported themes look unchanged until customized.
    public var typography: ThemeTypography

    public init(
        id: String = UUID().uuidString,
        name: String,
        appearance: ThemeAppearance,
        isBuiltIn: Bool = false,
        foreground: RGBAColor,
        background: RGBAColor,
        cursor: RGBAColor,
        selection: RGBAColor,
        ansi: [RGBAColor],
        roleOverrides: [String: RGBAColor] = [:],
        typography: ThemeTypography = .system
    ) {
        self.id = id
        self.name = name
        self.appearance = appearance
        self.isBuiltIn = isBuiltIn
        self.foreground = foreground
        self.background = background
        self.cursor = cursor
        self.selection = selection
        self.ansi = ansi
        self.roleOverrides = roleOverrides
        self.typography = typography
    }

    // Custom decoding so themes persisted before typography existed still load
    // (the field defaults to `.system` when absent).
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        appearance = try container.decode(ThemeAppearance.self, forKey: .appearance)
        isBuiltIn = try container.decode(Bool.self, forKey: .isBuiltIn)
        foreground = try container.decode(RGBAColor.self, forKey: .foreground)
        background = try container.decode(RGBAColor.self, forKey: .background)
        cursor = try container.decode(RGBAColor.self, forKey: .cursor)
        selection = try container.decode(RGBAColor.self, forKey: .selection)
        ansi = try container.decode([RGBAColor].self, forKey: .ansi)
        roleOverrides = try container.decodeIfPresent([String: RGBAColor].self, forKey: .roleOverrides) ?? [:]
        typography = try container.decodeIfPresent(ThemeTypography.self, forKey: .typography) ?? .system
    }
}

extension ColorTheme {
    /// The number of ANSI colors a well-formed theme carries.
    public static let ansiColorCount = 16

    /// True when the palette is structurally valid (16 ANSI colors present).
    public var hasValidPalette: Bool { ansi.count == Self.ansiColorCount }

    /// Returns the ANSI color at `index`, or nil if out of range.
    public func ansiColor(at index: Int) -> RGBAColor? {
        guard ansi.indices.contains(index) else { return nil }
        return ansi[index]
    }
}

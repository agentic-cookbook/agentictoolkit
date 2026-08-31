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
    /// Built-ins are read-only in the UI (duplicate to edit). They are also never
    /// deletable.
    public var isBuiltIn: Bool
    /// Themes brought in from an external file (JSON or `.itermcolors`). Like
    /// built-ins they are **locked** — read-only in the UI, edited by duplicating —
    /// but unlike built-ins they *are* deletable. A duplicate is a plain custom
    /// theme (`isBuiltIn == false && isImported == false`), so it edits freely.
    public var isImported: Bool
    /// Optional free-form credit for the theme's author/source (e.g.
    /// "Ethan Schoonover"). Shown in the editor and preserved on export.
    public var attribution: String?

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

    // MARK: Optional per-feature overrides

    /// Terminal padding / font / caret this theme overrides. `nil` — the state
    /// every theme starts in — means the Terminal settings panel decides.
    public var terminal: ThemeTerminalOptions?

    /// Project-window chrome this theme overrides. `nil` means the Projects
    /// settings panel decides.
    public var project: ThemeProjectOptions?

    public init(
        id: String = UUID().uuidString,
        name: String,
        appearance: ThemeAppearance,
        isBuiltIn: Bool = false,
        isImported: Bool = false,
        attribution: String? = nil,
        foreground: RGBAColor,
        background: RGBAColor,
        cursor: RGBAColor,
        selection: RGBAColor,
        ansi: [RGBAColor],
        roleOverrides: [String: RGBAColor] = [:],
        typography: ThemeTypography = .system,
        terminal: ThemeTerminalOptions? = nil,
        project: ThemeProjectOptions? = nil
    ) {
        self.id = id
        self.name = name
        self.appearance = appearance
        self.isBuiltIn = isBuiltIn
        self.isImported = isImported
        self.attribution = attribution
        self.foreground = foreground
        self.background = background
        self.cursor = cursor
        self.selection = selection
        self.ansi = ansi
        self.roleOverrides = roleOverrides
        self.typography = typography
        self.terminal = terminal
        self.project = project
    }

    // Custom decoding so themes persisted before typography existed still load
    // (the field defaults to `.system` when absent).
    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        name = try container.decode(String.self, forKey: .name)
        appearance = try container.decode(ThemeAppearance.self, forKey: .appearance)
        // `isBuiltIn` / `isImported` are internal lock flags a hand-authored or
        // third-party theme file wouldn't carry, and the import path overwrites
        // them anyway — so default them when absent rather than failing to decode.
        // (Persisted custom themes are never built-in, so `false` is also correct
        // for the storage round-trip.)
        isBuiltIn = try container.decodeIfPresent(Bool.self, forKey: .isBuiltIn) ?? false
        // Fields added after the first shipping format default when absent, so
        // themes persisted (or exported) by an older build still decode.
        isImported = try container.decodeIfPresent(Bool.self, forKey: .isImported) ?? false
        attribution = try container.decodeIfPresent(String.self, forKey: .attribution)
        foreground = try container.decode(RGBAColor.self, forKey: .foreground)
        background = try container.decode(RGBAColor.self, forKey: .background)
        cursor = try container.decode(RGBAColor.self, forKey: .cursor)
        selection = try container.decode(RGBAColor.self, forKey: .selection)
        ansi = try container.decode([RGBAColor].self, forKey: .ansi)
        roleOverrides = try container.decodeIfPresent([String: RGBAColor].self, forKey: .roleOverrides) ?? [:]
        typography = try container.decodeIfPresent(ThemeTypography.self, forKey: .typography) ?? .system
        // Absent is the meaningful state, not a migration fallback: a theme that
        // has never been given terminal or project overrides has none.
        terminal = try container.decodeIfPresent(ThemeTerminalOptions.self, forKey: .terminal)
        project = try container.decodeIfPresent(ThemeProjectOptions.self, forKey: .project)
    }
}

extension ColorTheme {
    /// True when the theme can be edited in place. Built-ins and imported themes
    /// are locked (edit by duplicating); a plain custom theme is editable.
    public var isEditable: Bool { !isBuiltIn && !isImported }

    /// True when the theme is read-only in the UI and shows a lock affordance.
    /// The inverse of `isEditable`.
    public var isLocked: Bool { !isEditable }

    /// True when the theme can be removed. Built-ins are permanent; imported and
    /// custom themes can be deleted.
    public var isDeletable: Bool { !isBuiltIn }

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

import Foundation

/// The built-in color themes shipped with the toolkit. These are the **single
/// source of truth** for the bundled schemes — the terminal feature derives its
/// built-in profiles from this list (see `ColorTheme.terminalPalette`), so a
/// theme is defined exactly once.
///
/// Each theme carries its terminal palette **and** explicit `roleOverrides` for
/// the app-chrome roles (surface / elevatedSurface / controlBackground / border /
/// outline) using the scheme's own published panel + line colors — so panels and
/// borders look authentic instead of muddy luminance blends. Text/accent/status
/// roles derive from the palette (contrast-guaranteed in `SemanticPalette`).
///
/// IDs are stable UUID strings (shared with the terminal feature's historical
/// profile IDs) so persisted "active theme" selections survive upgrades.
public enum BuiltInThemes {

    /// All built-in themes, in display order.
    public static let all: [ColorTheme] = [
        solarizedDark, solarizedLight, dracula, nord, tokyoNight,
        oneDark, monokaiPro, rosePine, catppuccinMocha, catppuccinLatte,
        ayuDark, githubDark, githubLight, gruvboxDark, gruvboxLight
    ]

    /// The default theme ID (Solarized Dark).
    public static let defaultID = "A1B2C3D4-0001-4000-8000-000000000001"

    /// Looks up a built-in theme by ID.
    public static func theme(withID id: String) -> ColorTheme? {
        all.first { $0.id == id }
    }

    // MARK: - Dark themes

    public static let solarizedDark = ColorTheme(
        id: "A1B2C3D4-0001-4000-8000-000000000001",
        name: "Solarized Dark",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("839496"), background: rgb("002b36"),
        cursor: rgb("839496"), selection: rgb("073642"),
        ansi: [
            "073642", "dc322f", "859900", "b58900",
            "268bd2", "d33682", "2aa198", "eee8d5",
            "002b36", "cb4b16", "586e75", "657b83",
            "839496", "6c71c4", "93a1a1", "fdf6e3"
        ].map(rgb),
        roleOverrides: chrome(surface: "073642", elevated: "0a4250",
                              control: "04313d", border: "0e4452", outline: "1d5b69")
    )

    public static let dracula = ColorTheme(
        id: "A1B2C3D4-0003-4000-8000-000000000003",
        name: "Dracula",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("f8f8f2"), background: rgb("282a36"),
        cursor: rgb("f8f8f2"), selection: rgb("44475a"),
        ansi: [
            "21222c", "ff5555", "50fa7b", "f1fa8c",
            "bd93f9", "ff79c6", "8be9fd", "f8f8f2",
            "6272a4", "ff6e6e", "69ff94", "ffffa5",
            "d6acff", "ff92df", "a4ffff", "ffffff"
        ].map(rgb),
        roleOverrides: chrome(surface: "343746", elevated: "424450",
                              control: "2d2f3a", border: "44475a", outline: "565872")
    )

    public static let nord = ColorTheme(
        id: "A1B2C3D4-0004-4000-8000-000000000004",
        name: "Nord",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("d8dee9"), background: rgb("2e3440"),
        cursor: rgb("d8dee9"), selection: rgb("434c5e"),
        ansi: [
            "3b4252", "bf616a", "a3be8c", "ebcb8b",
            "81a1c1", "b48ead", "88c0d0", "e5e9f0",
            "4c566a", "bf616a", "a3be8c", "ebcb8b",
            "81a1c1", "b48ead", "8fbcbb", "eceff4"
        ].map(rgb),
        roleOverrides: chrome(surface: "3b4252", elevated: "434c5e",
                              control: "353b48", border: "434c5e", outline: "4c566a")
    )

    public static let tokyoNight = ColorTheme(
        id: "A1B2C3D4-0005-4000-8000-000000000005",
        name: "Tokyo Night",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("a9b1d6"), background: rgb("1a1b26"),
        cursor: rgb("c0caf5"), selection: rgb("33467c"),
        ansi: [
            "15161e", "f7768e", "9ece6a", "e0af68",
            "7aa2f7", "bb9af7", "7dcfff", "a9b1d6",
            "414868", "f7768e", "9ece6a", "e0af68",
            "7aa2f7", "bb9af7", "7dcfff", "c0caf5"
        ].map(rgb),
        roleOverrides: chrome(surface: "1f2335", elevated: "24283b",
                              control: "1d1e2c", border: "292e42", outline: "3b4261")
    )

    public static let oneDark = ColorTheme(
        id: "A1B2C3D4-0009-4000-8000-000000000009",
        name: "One Dark",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("abb2bf"), background: rgb("282c34"),
        cursor: rgb("528bff"), selection: rgb("3e4451"),
        ansi: [
            "282c34", "e06c75", "98c379", "e5c07b",
            "61afef", "c678dd", "56b6c2", "abb2bf",
            "5c6370", "e06c75", "98c379", "e5c07b",
            "61afef", "c678dd", "56b6c2", "ffffff"
        ].map(rgb),
        roleOverrides: chrome(surface: "2c313a", elevated: "3a3f4b",
                              control: "21252b", border: "3e4451", outline: "4b5263")
    )

    public static let monokaiPro = ColorTheme(
        id: "A1B2C3D4-0010-4000-8000-000000000010",
        name: "Monokai Pro",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("fcfcfa"), background: rgb("2d2a2e"),
        cursor: rgb("fcfcfa"), selection: rgb("5b595c"),
        ansi: [
            "403e41", "ff6188", "a9dc76", "ffd866",
            "78dce8", "ab9df2", "78dce8", "fcfcfa",
            "727072", "ff6188", "a9dc76", "ffd866",
            "78dce8", "ab9df2", "78dce8", "fcfcfa"
        ].map(rgb),
        roleOverrides: chrome(surface: "353236", elevated: "423f43",
                              control: "262329", border: "403e41", outline: "5b595c")
    )

    public static let rosePine = ColorTheme(
        id: "A1B2C3D4-0011-4000-8000-000000000011",
        name: "Rosé Pine",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("e0def4"), background: rgb("191724"),
        cursor: rgb("e0def4"), selection: rgb("403d52"),
        ansi: [
            "26233a", "eb6f92", "31748f", "f6c177",
            "9ccfd8", "c4a7e7", "ebbcba", "e0def4",
            "6e6a86", "eb6f92", "31748f", "f6c177",
            "9ccfd8", "c4a7e7", "ebbcba", "e0def4"
        ].map(rgb),
        roleOverrides: chrome(surface: "1f1d2e", elevated: "26233a",
                              control: "1c1b2a", border: "403d52", outline: "524f67")
    )

    public static let catppuccinMocha = ColorTheme(
        id: "A1B2C3D4-0008-4000-8000-000000000008",
        name: "Catppuccin Mocha",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("cdd6f4"), background: rgb("1e1e2e"),
        cursor: rgb("f5e0dc"), selection: rgb("45475a"),
        ansi: [
            "45475a", "f38ba8", "a6e3a1", "f9e2af",
            "89b4fa", "f5c2e7", "94e2d5", "bac2de",
            "585b70", "f38ba8", "a6e3a1", "f9e2af",
            "89b4fa", "f5c2e7", "94e2d5", "a6adc8"
        ].map(rgb),
        roleOverrides: chrome(surface: "313244", elevated: "45475a",
                              control: "292a3a", border: "45475a", outline: "585b70")
    )

    public static let ayuDark = ColorTheme(
        id: "A1B2C3D4-0015-4000-8000-000000000015",
        name: "Ayu Dark",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("b3b1ad"), background: rgb("0a0e14"),
        cursor: rgb("ffcc66"), selection: rgb("1d2733"),
        ansi: [
            "01060e", "ea6c73", "91b362", "f9af4f",
            "53bdfa", "fae994", "90e1c6", "c7c7c7",
            "686868", "f07178", "c2d94c", "ffb454",
            "59c2ff", "ffee99", "95e6cb", "ffffff"
        ].map(rgb),
        roleOverrides: chrome(surface: "0d1017", elevated: "14191f",
                              control: "0b0f15", border: "1d242c", outline: "2d3640")
    )

    public static let githubDark = ColorTheme(
        id: "A1B2C3D4-0014-4000-8000-000000000014",
        name: "GitHub Dark",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("c9d1d9"), background: rgb("0d1117"),
        cursor: rgb("58a6ff"), selection: rgb("173b6b"),
        ansi: [
            "484f58", "ff7b72", "3fb950", "d29922",
            "58a6ff", "bc8cff", "39c5cf", "b1bac4",
            "6e7681", "ffa198", "56d364", "e3b341",
            "79c0ff", "d2a8ff", "56d4dd", "f0f6fc"
        ].map(rgb),
        roleOverrides: chrome(surface: "161b22", elevated: "21262d",
                              control: "0d1117", border: "30363d", outline: "484f58")
    )

    public static let gruvboxDark = ColorTheme(
        id: "A1B2C3D4-0007-4000-8000-000000000007",
        name: "Gruvbox Dark",
        appearance: .dark,
        isBuiltIn: true,
        foreground: rgb("ebdbb2"), background: rgb("282828"),
        cursor: rgb("ebdbb2"), selection: rgb("504945"),
        ansi: [
            "282828", "cc241d", "98971a", "d79921",
            "458588", "b16286", "689d6a", "a89984",
            "928374", "fb4934", "b8bb26", "fabd2f",
            "83a598", "d3869b", "8ec07c", "ebdbb2"
        ].map(rgb),
        roleOverrides: chrome(surface: "32302f", elevated: "3c3836",
                              control: "2d2c2c", border: "504945", outline: "665c54")
    )

    // MARK: - Light themes

    public static let solarizedLight = ColorTheme(
        id: "A1B2C3D4-0002-4000-8000-000000000002",
        name: "Solarized Light",
        appearance: .light,
        isBuiltIn: true,
        foreground: rgb("657b83"), background: rgb("fdf6e3"),
        cursor: rgb("657b83"), selection: rgb("eee8d5"),
        ansi: [
            "073642", "dc322f", "859900", "b58900",
            "268bd2", "d33682", "2aa198", "eee8d5",
            "002b36", "cb4b16", "586e75", "657b83",
            "839496", "6c71c4", "93a1a1", "fdf6e3"
        ].map(rgb),
        roleOverrides: chrome(surface: "eee8d5", elevated: "e4ddc8",
                              control: "f5efdc", border: "d9d2bd", outline: "c4bda8")
    )

    public static let catppuccinLatte = ColorTheme(
        id: "A1B2C3D4-0012-4000-8000-000000000012",
        name: "Catppuccin Latte",
        appearance: .light,
        isBuiltIn: true,
        foreground: rgb("4c4f69"), background: rgb("eff1f5"),
        cursor: rgb("dc8a78"), selection: rgb("ccd0da"),
        ansi: [
            "5c5f77", "d20f39", "40a02b", "df8e1d",
            "1e66f5", "ea76cb", "179299", "acb0be",
            "6c6f85", "d20f39", "40a02b", "df8e1d",
            "1e66f5", "ea76cb", "179299", "bcc0cc"
        ].map(rgb),
        roleOverrides: chrome(surface: "e6e9ef", elevated: "dce0e8",
                              control: "eff1f5", border: "ccd0da", outline: "bcc0cc")
    )

    public static let githubLight = ColorTheme(
        id: "A1B2C3D4-0006-4000-8000-000000000006",
        name: "GitHub Light",
        appearance: .light,
        isBuiltIn: true,
        foreground: rgb("24292e"), background: rgb("ffffff"),
        cursor: rgb("044289"), selection: rgb("c8c8fa"),
        ansi: [
            "24292e", "d73a49", "28a745", "dbab09",
            "0366d6", "5a32a3", "0598bc", "6a737d",
            "959da5", "cb2431", "22863a", "b08800",
            "005cc5", "5a32a3", "3192aa", "d1d5da"
        ].map(rgb),
        roleOverrides: chrome(surface: "f6f8fa", elevated: "ffffff",
                              control: "f6f8fa", border: "d0d7de", outline: "afb8c1")
    )

    public static let gruvboxLight = ColorTheme(
        id: "A1B2C3D4-0013-4000-8000-000000000013",
        name: "Gruvbox Light",
        appearance: .light,
        isBuiltIn: true,
        foreground: rgb("3c3836"), background: rgb("fbf1c7"),
        cursor: rgb("3c3836"), selection: rgb("ebdbb2"),
        ansi: [
            "fbf1c7", "cc241d", "98971a", "d79921",
            "458588", "b16286", "689d6a", "7c6f64",
            "928374", "9d0006", "79740e", "b57614",
            "076678", "8f3f71", "427b58", "3c3836"
        ].map(rgb),
        roleOverrides: chrome(surface: "f2e5bc", elevated: "ebdbb2",
                              control: "fbf1c7", border: "d5c4a1", outline: "bdae93")
    )

    // MARK: - Helpers

    /// Builds explicit app-chrome role overrides from a scheme's published panel
    /// and line colors, so surfaces/borders look authentic rather than derived.
    private static func chrome(
        surface: String, elevated: String, control: String, border: String, outline: String
    ) -> [String: RGBAColor] {
        [
            ThemeRole.surface.rawValue: rgb(surface),
            ThemeRole.elevatedSurface.rawValue: rgb(elevated),
            ThemeRole.controlBackground.rawValue: rgb(control),
            ThemeRole.border.rawValue: rgb(border),
            ThemeRole.outline.rawValue: rgb(outline)
        ]
    }

    /// Parses a `"rrggbb"` (or `"#rrggbb"`) constant into an opaque `RGBAColor`.
    /// Built-in constants are validated by `BuiltInThemesTests`; a malformed
    /// literal traps at first use (fail-fast).
    private static func rgb(_ hex: String) -> RGBAColor {
        let trimmed = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        guard let color = RGBAColor(hexString: "#" + trimmed + "FF") else {
            preconditionFailure("Invalid built-in theme hex: \(hex)")
        }
        return color
    }
}

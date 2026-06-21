import Foundation

/// The built-in color themes shipped with the toolkit. These are the **single
/// source of truth** for the bundled schemes — the terminal feature derives its
/// built-in profiles from this list (see `ColorTheme.terminalPalette`), so a
/// theme is defined exactly once.
///
/// IDs are stable UUID strings (shared with the terminal feature's historical
/// profile IDs) so persisted "active theme" selections survive upgrades.
public enum BuiltInThemes {

    /// All built-in themes, in display order.
    public static let all: [ColorTheme] = [
        solarizedDark, solarizedLight, dracula, nord,
        tokyoNight, githubLight, gruvboxDark, catppuccinMocha
    ]

    /// The default theme ID (Solarized Dark).
    public static let defaultID = "A1B2C3D4-0001-4000-8000-000000000001"

    /// Looks up a built-in theme by ID.
    public static func theme(withID id: String) -> ColorTheme? {
        all.first { $0.id == id }
    }

    // MARK: - Themes

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
        ].map(rgb)
    )

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
        ].map(rgb)
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
        ].map(rgb)
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
        ].map(rgb)
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
        ].map(rgb)
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
        ].map(rgb)
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
        ].map(rgb)
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
        ].map(rgb)
    )

    // MARK: - Hex helper

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

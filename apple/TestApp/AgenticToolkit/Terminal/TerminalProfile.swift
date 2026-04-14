import Foundation
import AppKit

// MARK: - ProfileAppearance

enum ProfileAppearance: String, Codable, CaseIterable, Identifiable {
    case dark
    case light
    case auto

    var id: String { rawValue }
}

// MARK: - CursorStyle

enum CursorStyle: String, Codable, CaseIterable, Identifiable {
    case block
    case underline
    case bar

    var id: String { rawValue }

    var label: String {
        switch self {
        case .block: return "Block"
        case .underline: return "Underline"
        case .bar: return "Bar"
        }
    }
}

// MARK: - ColorPalette

struct ColorPalette: Codable, Equatable {
    /// Foreground text color as "#rrggbb"
    var foreground: String
    /// Background color as "#rrggbb"
    var background: String
    /// Cursor/accent color as "#rrggbb"
    var cursor: String
    /// Selection highlight color as "#rrggbb"
    var selection: String
    /// 16 ANSI colors (indices 0-15) as "#rrggbb"
    var ansi: [String]
}

// MARK: - AppProfile

struct AppProfile: Codable, Identifiable, Equatable {
    var id: UUID
    var name: String
    var appearance: ProfileAppearance
    var fontName: String
    var fontSize: Double
    var cursorStyle: CursorStyle
    var colors: ColorPalette
    var isDeletable: Bool

    init(
        id: UUID = UUID(),
        name: String,
        appearance: ProfileAppearance,
        fontName: String = "Menlo",
        fontSize: Double = 13,
        cursorStyle: CursorStyle = .block,
        colors: ColorPalette,
        isDeletable: Bool = true
    ) {
        self.id = id
        self.name = name
        self.appearance = appearance
        self.fontName = fontName
        self.fontSize = fontSize
        self.cursorStyle = cursorStyle
        self.colors = colors
        self.isDeletable = isDeletable
    }

    /// The default profile ID (Solarized Dark).
    static let defaultProfileID = "A1B2C3D4-0001-4000-8000-000000000001"

    /// Returns the active profile by reading the stored profile ID from UserDefaults.
    /// Falls back to Solarized Dark if the stored ID doesn't match any profile.
    static func activeProfile() -> AppProfile {
        let storedID = UserDefaults.standard.string(forKey: "app.activeProfileID") ?? defaultProfileID
        let all = builtInProfiles()
        if let uuid = UUID(uuidString: storedID),
           let match = all.first(where: { $0.id == uuid }) {
            return match
        }
        return all[0]
    }

    // MARK: - Built-in Profiles

    static func builtInProfiles() -> [AppProfile] {
        [
            solarizedDark, solarizedLight, dracula, nord,
            tokyoNight, githubLight, gruvboxDark, catppuccinMocha,
        ]
    }

    // MARK: 1. Solarized Dark

    private static let solarizedDark = AppProfile(
        id: UUID(uuidString: "A1B2C3D4-0001-4000-8000-000000000001")!,
        name: "Solarized Dark",
        appearance: .dark,
        cursorStyle: .block,
        colors: ColorPalette(
            foreground: "#839496", background: "#002b36", cursor: "#839496", selection: "#073642",
            ansi: [
                "#073642", "#dc322f", "#859900", "#b58900",
                "#268bd2", "#d33682", "#2aa198", "#eee8d5",
                "#002b36", "#cb4b16", "#586e75", "#657b83",
                "#839496", "#6c71c4", "#93a1a1", "#fdf6e3",
            ]
        ),
        isDeletable: false
    )

    // MARK: 2. Solarized Light

    private static let solarizedLight = AppProfile(
        id: UUID(uuidString: "A1B2C3D4-0002-4000-8000-000000000002")!,
        name: "Solarized Light",
        appearance: .light,
        cursorStyle: .block,
        colors: ColorPalette(
            foreground: "#657b83", background: "#fdf6e3", cursor: "#657b83", selection: "#eee8d5",
            ansi: [
                "#073642", "#dc322f", "#859900", "#b58900",
                "#268bd2", "#d33682", "#2aa198", "#eee8d5",
                "#002b36", "#cb4b16", "#586e75", "#657b83",
                "#839496", "#6c71c4", "#93a1a1", "#fdf6e3",
            ]
        ),
        isDeletable: false
    )

    // MARK: 3. Dracula

    private static let dracula = AppProfile(
        id: UUID(uuidString: "A1B2C3D4-0003-4000-8000-000000000003")!,
        name: "Dracula",
        appearance: .dark,
        cursorStyle: .block,
        colors: ColorPalette(
            foreground: "#f8f8f2", background: "#282a36", cursor: "#f8f8f2", selection: "#44475a",
            ansi: [
                "#21222c", "#ff5555", "#50fa7b", "#f1fa8c",
                "#bd93f9", "#ff79c6", "#8be9fd", "#f8f8f2",
                "#6272a4", "#ff6e6e", "#69ff94", "#ffffa5",
                "#d6acff", "#ff92df", "#a4ffff", "#ffffff",
            ]
        ),
        isDeletable: false
    )

    // MARK: 4. Nord

    private static let nord = AppProfile(
        id: UUID(uuidString: "A1B2C3D4-0004-4000-8000-000000000004")!,
        name: "Nord",
        appearance: .dark,
        cursorStyle: .block,
        colors: ColorPalette(
            foreground: "#d8dee9", background: "#2e3440", cursor: "#d8dee9", selection: "#434c5e",
            ansi: [
                "#3b4252", "#bf616a", "#a3be8c", "#ebcb8b",
                "#81a1c1", "#b48ead", "#88c0d0", "#e5e9f0",
                "#4c566a", "#bf616a", "#a3be8c", "#ebcb8b",
                "#81a1c1", "#b48ead", "#8fbcbb", "#eceff4",
            ]
        ),
        isDeletable: false
    )

    // MARK: 5. Tokyo Night

    private static let tokyoNight = AppProfile(
        id: UUID(uuidString: "A1B2C3D4-0005-4000-8000-000000000005")!,
        name: "Tokyo Night",
        appearance: .dark,
        cursorStyle: .block,
        colors: ColorPalette(
            foreground: "#a9b1d6", background: "#1a1b26", cursor: "#c0caf5", selection: "#33467c",
            ansi: [
                "#15161e", "#f7768e", "#9ece6a", "#e0af68",
                "#7aa2f7", "#bb9af7", "#7dcfff", "#a9b1d6",
                "#414868", "#f7768e", "#9ece6a", "#e0af68",
                "#7aa2f7", "#bb9af7", "#7dcfff", "#c0caf5",
            ]
        ),
        isDeletable: false
    )

    // MARK: 6. GitHub Light

    private static let githubLight = AppProfile(
        id: UUID(uuidString: "A1B2C3D4-0006-4000-8000-000000000006")!,
        name: "GitHub Light",
        appearance: .light,
        cursorStyle: .block,
        colors: ColorPalette(
            foreground: "#24292e", background: "#ffffff", cursor: "#044289", selection: "#c8c8fa",
            ansi: [
                "#24292e", "#d73a49", "#28a745", "#dbab09",
                "#0366d6", "#5a32a3", "#0598bc", "#6a737d",
                "#959da5", "#cb2431", "#22863a", "#b08800",
                "#005cc5", "#5a32a3", "#3192aa", "#d1d5da",
            ]
        ),
        isDeletable: false
    )

    // MARK: 7. Gruvbox Dark

    private static let gruvboxDark = AppProfile(
        id: UUID(uuidString: "A1B2C3D4-0007-4000-8000-000000000007")!,
        name: "Gruvbox Dark",
        appearance: .dark,
        cursorStyle: .block,
        colors: ColorPalette(
            foreground: "#ebdbb2", background: "#282828", cursor: "#ebdbb2", selection: "#504945",
            ansi: [
                "#282828", "#cc241d", "#98971a", "#d79921",
                "#458588", "#b16286", "#689d6a", "#a89984",
                "#928374", "#fb4934", "#b8bb26", "#fabd2f",
                "#83a598", "#d3869b", "#8ec07c", "#ebdbb2",
            ]
        ),
        isDeletable: false
    )

    // MARK: 8. Catppuccin Mocha

    private static let catppuccinMocha = AppProfile(
        id: UUID(uuidString: "A1B2C3D4-0008-4000-8000-000000000008")!,
        name: "Catppuccin Mocha",
        appearance: .dark,
        cursorStyle: .block,
        colors: ColorPalette(
            foreground: "#cdd6f4", background: "#1e1e2e", cursor: "#f5e0dc", selection: "#45475a",
            ansi: [
                "#45475a", "#f38ba8", "#a6e3a1", "#f9e2af",
                "#89b4fa", "#f5c2e7", "#94e2d5", "#bac2de",
                "#585b70", "#f38ba8", "#a6e3a1", "#f9e2af",
                "#89b4fa", "#f5c2e7", "#94e2d5", "#a6adc8",
            ]
        ),
        isDeletable: false
    )
}

// MARK: - NSColor Hex Parsing

extension NSColor {
    /// Creates an NSColor from a hex string like `#rrggbb` or `rrggbb`.
    convenience init?(hex: String) {
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hexString.hasPrefix("#") { hexString = String(hexString.dropFirst()) }
        guard hexString.count == 6 else { return nil }
        var rgb: UInt64 = 0
        guard Scanner(string: hexString).scanHexInt64(&rgb) else { return nil }

        let r = CGFloat((rgb >> 16) & 0xFF) / 255.0
        let g = CGFloat((rgb >> 8) & 0xFF) / 255.0
        let b = CGFloat(rgb & 0xFF) / 255.0
        self.init(srgbRed: r, green: g, blue: b, alpha: 1.0)
    }
}

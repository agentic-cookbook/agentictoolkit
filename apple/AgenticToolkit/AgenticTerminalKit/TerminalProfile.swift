import AppKit
import Foundation

public enum ProfileAppearance: String, Codable, CaseIterable, Identifiable, Sendable {
    case dark
    case light
    case auto

    public var id: String { rawValue }
}

public enum CursorStyle: String, Codable, CaseIterable, Identifiable, Sendable {
    case block
    case underline
    case bar

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .block: return "Block"
        case .underline: return "Underline"
        case .bar: return "Bar"
        }
    }
}

public struct TerminalColorPalette: Codable, Equatable, Sendable {
    /// Foreground text color as "#rrggbb"
    public var foreground: String
    /// Background color as "#rrggbb"
    public var background: String
    /// Cursor color as "#rrggbb"
    public var cursor: String
    /// Selection highlight color as "#rrggbb"
    public var selection: String
    /// 16 ANSI colors (indices 0-15) as "#rrggbb"
    public var ansi: [String]

    public init(foreground: String, background: String, cursor: String, selection: String, ansi: [String]) {
        self.foreground = foreground
        self.background = background
        self.cursor = cursor
        self.selection = selection
        self.ansi = ansi
    }
}

public struct TerminalProfile: Codable, Identifiable, Equatable, Sendable {
    public var id: UUID
    public var name: String
    public var appearance: ProfileAppearance
    public var fontName: String
    public var fontSize: Double
    public var cursorStyle: CursorStyle
    public var colors: TerminalColorPalette
    public var isDeletable: Bool

    public init(
        id: UUID = UUID(),
        name: String,
        appearance: ProfileAppearance,
        fontName: String = "Menlo",
        fontSize: Double = 13,
        cursorStyle: CursorStyle = .block,
        colors: TerminalColorPalette,
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

    /// Posted when the user changes the active terminal profile or edits an
    /// existing one. `TerminalContentViewController` observes this to reapply
    /// the profile to the active terminal view.
    public static let didChangeNotification = Notification.Name("AgenticAppKit.TerminalProfile.didChange")

    /// The default profile ID (Solarized Dark).
    public static let defaultProfileID = "A1B2C3D4-0001-4000-8000-000000000001"

    /// Returns the active profile by reading the stored profile ID from UserDefaults.
    /// Falls back to Solarized Dark if the stored ID doesn't match any profile.
    public static func activeProfile() -> TerminalProfile {
        let storedID = UserDefaults.standard.string(forKey: "terminal.activeProfileID") ?? defaultProfileID
        let all = builtInProfiles()
        if let uuid = UUID(uuidString: storedID),
           let match = all.first(where: { $0.id == uuid }) {
            return match
        }
        return all[0]
    }

    public static func builtInProfiles() -> [TerminalProfile] {
        [
            solarizedDark, solarizedLight, dracula, nord,
            tokyoNight, githubLight, gruvboxDark, catppuccinMocha,
        ]
    }

    private static let solarizedDark = TerminalProfile(
        id: UUID(uuidString: "A1B2C3D4-0001-4000-8000-000000000001")!,
        name: "Solarized Dark",
        appearance: .dark,
        cursorStyle: .block,
        colors: TerminalColorPalette(
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

    private static let solarizedLight = TerminalProfile(
        id: UUID(uuidString: "A1B2C3D4-0002-4000-8000-000000000002")!,
        name: "Solarized Light",
        appearance: .light,
        cursorStyle: .block,
        colors: TerminalColorPalette(
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

    private static let dracula = TerminalProfile(
        id: UUID(uuidString: "A1B2C3D4-0003-4000-8000-000000000003")!,
        name: "Dracula",
        appearance: .dark,
        cursorStyle: .block,
        colors: TerminalColorPalette(
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

    private static let nord = TerminalProfile(
        id: UUID(uuidString: "A1B2C3D4-0004-4000-8000-000000000004")!,
        name: "Nord",
        appearance: .dark,
        cursorStyle: .block,
        colors: TerminalColorPalette(
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

    private static let tokyoNight = TerminalProfile(
        id: UUID(uuidString: "A1B2C3D4-0005-4000-8000-000000000005")!,
        name: "Tokyo Night",
        appearance: .dark,
        cursorStyle: .block,
        colors: TerminalColorPalette(
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

    private static let githubLight = TerminalProfile(
        id: UUID(uuidString: "A1B2C3D4-0006-4000-8000-000000000006")!,
        name: "GitHub Light",
        appearance: .light,
        cursorStyle: .block,
        colors: TerminalColorPalette(
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

    private static let gruvboxDark = TerminalProfile(
        id: UUID(uuidString: "A1B2C3D4-0007-4000-8000-000000000007")!,
        name: "Gruvbox Dark",
        appearance: .dark,
        cursorStyle: .block,
        colors: TerminalColorPalette(
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

    private static let catppuccinMocha = TerminalProfile(
        id: UUID(uuidString: "A1B2C3D4-0008-4000-8000-000000000008")!,
        name: "Catppuccin Mocha",
        appearance: .dark,
        cursorStyle: .block,
        colors: TerminalColorPalette(
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

extension NSColor {
    /// Creates an NSColor from a hex string like `#rrggbb` or `rrggbb`.
    public convenience init?(hex: String) {
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

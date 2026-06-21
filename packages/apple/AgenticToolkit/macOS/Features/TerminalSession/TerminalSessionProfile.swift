import AppKit
import Foundation
import AgenticToolkitCore

public enum TerminalSessionProfileAppearance: String, Codable, CaseIterable, Identifiable, Sendable {
    case dark
    case light
    case auto

    public var id: String { rawValue }
}

public enum TerminalSessionCursorStyle: String, Codable, CaseIterable, Identifiable, Sendable {
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

public struct TerminalSessionColorPalette: Codable, Equatable, Sendable {
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

public struct TerminalSessionProfile: Codable, Identifiable, Equatable, Sendable {
    public var id: UUID
    public var name: String
    public var appearance: TerminalSessionProfileAppearance
    public var fontName: String
    public var fontSize: Double
    public var cursorStyle: TerminalSessionCursorStyle
    public var colors: TerminalSessionColorPalette
    public var isDeletable: Bool

    public init(
        id: UUID = UUID(),
        name: String,
        appearance: TerminalSessionProfileAppearance,
        fontName: String = "Menlo",
        fontSize: Double = 13,
        cursorStyle: TerminalSessionCursorStyle = .block,
        colors: TerminalSessionColorPalette,
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
    /// existing one. `TerminalSessionContentViewController` observes this to reapply
    /// the profile to the active terminal view.
    public static let didChangeNotification = Notification.Name("AgenticAppKit.TerminalSessionProfile.didChange")

    /// The default profile ID (Solarized Dark).
    public static let defaultProfileID = "A1B2C3D4-0001-4000-8000-000000000001"

    /// Returns the active profile by reading the stored profile ID from UserDefaults.
    /// Falls back to Solarized Dark if the stored ID doesn't match any profile.
    public static func activeProfile() -> TerminalSessionProfile {
        let storedID = UserDefaults.standard.string(forKey: "terminal.activeProfileID") ?? defaultProfileID
        let all = builtInProfiles()
        if let uuid = UUID(uuidString: storedID),
           let match = all.first(where: { $0.id == uuid }) {
            return match
        }
        return all[0]
    }

    /// Built-in profiles, derived from the single source of truth in
    /// `BuiltInThemes` (the canonical `ColorTheme` superset). Defining each
    /// scheme once keeps the terminal palette and the app theme in lockstep.
    public static func builtInProfiles() -> [TerminalSessionProfile] {
        BuiltInThemes.all.map { TerminalSessionProfile(from: $0) }
    }
}

extension NSColor {
    /// Creates an NSColor from a hex string like `#rrggbb` or `rrggbb`.
    public convenience init?(hex: String) {
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hexString.hasPrefix("#") { hexString = String(hexString.dropFirst()) }
        guard hexString.count == 6 else { return nil }
        var rgb: UInt64 = 0
        guard Scanner(string: hexString).scanHexInt64(&rgb) else { return nil }

        let red = CGFloat((rgb >> 16) & 0xFF) / 255.0
        let green = CGFloat((rgb >> 8) & 0xFF) / 255.0
        let blue = CGFloat(rgb & 0xFF) / 255.0
        self.init(srgbRed: red, green: green, blue: blue, alpha: 1.0)
    }
}

import AppKit
import SwiftTerm

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The caret's shape. Blinking is a separate setting rather than three more
/// cases, because "block, blinking" is how the user thinks about it and
/// SwiftTerm's six-case `CursorStyle` is an encoding detail (`srp`).
public enum TerminalCursorShape: String, Codable, CaseIterable, Sendable, Equatable {
    case block
    case underline
    case bar

    public var label: String {
        switch self {
        case .block:     return "Block  ▉"
        case .underline: return "Underline  _"
        case .bar:       return "Bar  |"
        }
    }

    public func cursorStyle(blinking: Bool) -> CursorStyle {
        switch self {
        case .block:     return blinking ? .blinkBlock : .steadyBlock
        case .underline: return blinking ? .blinkUnderline : .steadyUnderline
        case .bar:       return blinking ? .blinkBar : .steadyBar
        }
    }
}

/// What a terminal looks like: colors from the app theme, everything else from
/// the terminal settings.
///
/// This is the single place the two are combined, so the content view
/// controller has no opinion of its own and the settings panel has nothing to
/// apply. Colors deliberately do *not* get their own settings — a second
/// palette beside `ColorTheme` is exactly the drift that left the terminal
/// looking like a different app (`dry`).
@MainActor
public enum TerminalAppearance {

    /// Every `terminal_*` key, so a change to any of them can be recognized
    /// from `UserSettings.shared.changes` without five separate observers.
    public static let settingKeys: Set<String> = [
        UserSettings.terminalPadding.name,
        UserSettings.terminalUsesThemeFont.name,
        UserSettings.terminalFontName.name,
        UserSettings.terminalFontSize.name,
        UserSettings.terminalCursorShape.name,
        UserSettings.terminalCursorBlinks.name
    ]

    /// Font families that can render a terminal grid. A proportional font in a
    /// terminal is not a preference, it's a broken layout, so the picker never
    /// offers one.
    public static func monospacedFontFamilies() -> [String] {
        NSFontManager.shared.availableFontFamilies
            .filter { NSFont(name: $0, size: 12)?.isFixedPitch == true }
            .sorted()
    }

    /// The theme's code font unless the user has opted out of it.
    public static func resolvedFont(palette: SemanticPalette) -> NSFont {
        if UserSettings.terminalUsesThemeFont.value {
            return palette.font(.code)
        }
        let size = CGFloat(UserSettings.terminalFontSize.value)
        return NSFont(name: UserSettings.terminalFontName.value, size: size)
            ?? .monospacedSystemFont(ofSize: size, weight: .regular)
    }

    /// How far the terminal grid is held off its container's edges.
    public static func resolvedPadding() -> CGFloat {
        CGFloat(UserSettings.terminalPadding.value)
    }

    /// Paints `terminalView` with the theme's colors and the user's font and
    /// caret. Cheap enough to call on every theme or settings change.
    public static func apply(to terminalView: TerminalView, palette: SemanticPalette) {
        terminalView.nativeForegroundColor = palette.nsColor(.primaryText)
        terminalView.nativeBackgroundColor = palette.nsColor(.windowBackground)
        terminalView.caretColor = palette.nsColor(.cursor)
        terminalView.selectedTextBackgroundColor = palette.nsColor(.selection)

        let ansi = palette.theme.ansi.map(Self.swiftTermColor)
        if ansi.count == ColorTheme.ansiColorCount {
            terminalView.installColors(ansi)
        }

        terminalView.font = resolvedFont(palette: palette)

        terminalView.getTerminal().setCursorStyle(
            UserSettings.terminalCursorShape.value
                .cursorStyle(blinking: UserSettings.terminalCursorBlinks.value)
        )

        terminalView.needsDisplay = true
    }

    /// `RGBAColor` is normalized [0, 1]; SwiftTerm wants 16-bit channels.
    private static func swiftTermColor(_ color: RGBAColor) -> SwiftTerm.Color {
        SwiftTerm.Color(
            red: UInt16((color.red * 65_535).rounded()),
            green: UInt16((color.green * 65_535).rounded()),
            blue: UInt16((color.blue * 65_535).rounded())
        )
    }
}

extension UserSettings {

    /// Inset between the terminal grid and its container, in points.
    static public var terminalPadding = UserSetting<Double>("terminal_padding", default: 10)

    /// Whether the terminal uses the theme's code font rather than the two
    /// settings below.
    static public var terminalUsesThemeFont = UserSetting<Bool>("terminal_uses_theme_font", default: true)

    /// Font family used when `terminalUsesThemeFont` is off.
    static public var terminalFontName = UserSetting<String>("terminal_font_name", default: "Menlo")

    /// Font size used when `terminalUsesThemeFont` is off.
    static public var terminalFontSize = UserSetting<Double>("terminal_font_size", default: 13)

    /// Caret shape: block, underline or bar.
    static public var terminalCursorShape =
        UserSetting<TerminalCursorShape>("terminal_cursor_shape", default: .block)

    /// Whether the caret blinks.
    static public var terminalCursorBlinks = UserSetting<Bool>("terminal_cursor_blinks", default: true)
}

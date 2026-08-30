import AppKit
import SwiftTerm

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The caret's shape. Blinking is a separate setting rather than more cases,
/// because "block, blinking" is how the user thinks about it and SwiftTerm's
/// six-case `CursorStyle` is an encoding detail (`srp`).
public enum TerminalCursorShape: String, Codable, CaseIterable, Sendable, Equatable {
    case block
    case hollowBlock
    case underline
    case bar

    public var label: String {
        switch self {
        case .block:       return "Block  ▉"
        case .hollowBlock: return "Hollow Block  ▢"
        case .underline:   return "Underline  _"
        case .bar:         return "Bar  |"
        }
    }

    /// Both block shapes map to SwiftTerm's block: the difference between them
    /// is fill, which `ThemedTerminalView` draws, not a different style.
    public func cursorStyle(blinking: Bool) -> CursorStyle {
        switch self {
        case .block, .hollowBlock: return blinking ? .blinkBlock : .steadyBlock
        case .underline:           return blinking ? .blinkUnderline : .steadyUnderline
        case .bar:                 return blinking ? .blinkBar : .steadyBar
        }
    }
}

/// The four sides a terminal's padding is set on.
public struct TerminalPadding: Equatable, Sendable {
    public var top: CGFloat
    public var leading: CGFloat
    public var bottom: CGFloat
    public var trailing: CGFloat
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
    /// from `UserSettings.shared.changes` without one observer per setting.
    public static let settingKeys: Set<String> = [
        UserSettings.terminalPaddingTop.name,
        UserSettings.terminalPaddingLeading.name,
        UserSettings.terminalPaddingBottom.name,
        UserSettings.terminalPaddingTrailing.name,
        UserSettings.terminalUsesThemeFont.name,
        UserSettings.terminalFontName.name,
        UserSettings.terminalFontSize.name,
        UserSettings.terminalCursorShape.name,
        UserSettings.terminalCursorBlinks.name
    ]

    /// The theme's code font unless the user has opted out of it.
    ///
    /// The stored name is a PostScript font name rather than a family, because
    /// the whole point of the picker is telling `FiraCode Nerd Font Mono` from
    /// `FiraCode Nerd Font Propo` — a family name cannot.
    public static func resolvedFont(palette: SemanticPalette) -> NSFont {
        if UserSettings.terminalUsesThemeFont.value {
            return palette.font(.code)
        }
        let size = CGFloat(UserSettings.terminalFontSize.value)
        return NSFont(name: UserSettings.terminalFontName.value, size: size)
            ?? .monospacedSystemFont(ofSize: size, weight: .regular)
    }

    /// How far the terminal grid is held off its container's edges.
    public static func resolvedPadding() -> TerminalPadding {
        TerminalPadding(
            top: CGFloat(UserSettings.terminalPaddingTop.value),
            leading: CGFloat(UserSettings.terminalPaddingLeading.value),
            bottom: CGFloat(UserSettings.terminalPaddingBottom.value),
            trailing: CGFloat(UserSettings.terminalPaddingTrailing.value)
        )
    }

    /// Paints `terminalView` with the theme's colors and the user's font and
    /// caret. Cheap enough to call on every theme or settings change.
    public static func apply(to terminalView: TerminalView, palette: SemanticPalette) {
        terminalView.nativeForegroundColor = palette.nsColor(.primaryText)
        terminalView.nativeBackgroundColor = palette.nsColor(.windowBackground)
        terminalView.selectedTextBackgroundColor = palette.nsColor(.selection)

        let ansi = palette.theme.ansi.map(Self.swiftTermColor)
        if ansi.count == ColorTheme.ansiColorCount {
            terminalView.installColors(ansi)
        }

        terminalView.font = resolvedFont(palette: palette)

        applyCaret(to: terminalView, palette: palette)

        terminalView.needsDisplay = true
    }

    /// `setCursorStyle` only moves the `Terminal`'s own state; the AppKit caret
    /// is repainted by the view's `cursorStyleChanged`. Calling just the first
    /// is why changing the shape used to do nothing visible.
    private static func applyCaret(to terminalView: TerminalView, palette: SemanticPalette) {
        let shape = UserSettings.terminalCursorShape.value
        let style = shape.cursorStyle(blinking: UserSettings.terminalCursorBlinks.value)

        let terminal = terminalView.getTerminal()
        terminal.setCursorStyle(style)
        terminalView.cursorStyleChanged(source: terminal, newStyle: style)

        let cursorColor = palette.nsColor(.cursor)
        let hollow = shape == .hollowBlock

        // In hollow mode SwiftTerm's own fill has to disappear, and the glyph
        // under the caret has to keep reading as ordinary text rather than as
        // reversed-out caret text.
        terminalView.caretColor = hollow ? .clear : cursorColor
        terminalView.caretTextColor = hollow ? palette.nsColor(.primaryText) : nil

        if let themed = terminalView as? ThemedTerminalView {
            themed.hollowCaretColor = cursorColor
            themed.usesHollowCaret = hollow
        }
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

    /// Inset between the terminal grid and its container, per side, in points.
    /// Four settings rather than one because a terminal under a tab bar wants
    /// more room at the top than at the bottom, and that is not derivable.
    static public var terminalPaddingTop = UserSetting<Int>("terminal_padding_top", default: 10)
    static public var terminalPaddingLeading = UserSetting<Int>("terminal_padding_leading", default: 10)
    static public var terminalPaddingBottom = UserSetting<Int>("terminal_padding_bottom", default: 10)
    static public var terminalPaddingTrailing = UserSetting<Int>("terminal_padding_trailing", default: 10)

    /// Whether the terminal uses the theme's code font rather than the two
    /// settings below.
    static public var terminalUsesThemeFont = UserSetting<Bool>("terminal_uses_theme_font", default: true)

    /// PostScript font name used when `terminalUsesThemeFont` is off.
    static public var terminalFontName = UserSetting<String>("terminal_font_name", default: "Menlo-Regular")

    /// Font size used when `terminalUsesThemeFont` is off.
    static public var terminalFontSize = UserSetting<Double>("terminal_font_size", default: 13)

    /// Caret shape: block, hollow block, underline or bar.
    static public var terminalCursorShape =
        UserSetting<TerminalCursorShape>("terminal_cursor_shape", default: .block)

    /// Whether the caret blinks.
    static public var terminalCursorBlinks = UserSetting<Bool>("terminal_cursor_blinks", default: true)
}

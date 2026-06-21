import Foundation
import AgenticToolkitCore

/// Bridges the canonical `ColorTheme` (the superset model in
/// `AgenticToolkitCore`) onto the terminal feature's `TerminalSessionColorPalette`
/// and `TerminalSessionProfile`. The 8 built-in schemes are defined once in
/// `BuiltInThemes`; the terminal derives its built-in profiles from them.
extension ColorTheme {

    /// Projects the theme onto the terminal's `"#rrggbb"`-string palette (the
    /// subset of fields a terminal needs).
    public var terminalPalette: TerminalSessionColorPalette {
        TerminalSessionColorPalette(
            foreground: foreground.hexStringRGB,
            background: background.hexStringRGB,
            cursor: cursor.hexStringRGB,
            selection: selection.hexStringRGB,
            ansi: ansi.map { $0.hexStringRGB }
        )
    }
}

extension TerminalSessionProfileAppearance {
    public init(_ appearance: ThemeAppearance) {
        self = TerminalSessionProfileAppearance(rawValue: appearance.rawValue) ?? .dark
    }
}

extension TerminalSessionProfile {

    /// Builds a terminal profile from a `ColorTheme`, supplying the terminal-only
    /// fields (font, cursor style) that a theme does not carry.
    public init(
        from theme: ColorTheme,
        fontName: String = "Menlo",
        fontSize: Double = 13,
        cursorStyle: TerminalSessionCursorStyle = .block
    ) {
        self.init(
            id: UUID(uuidString: theme.id) ?? UUID(),
            name: theme.name,
            appearance: TerminalSessionProfileAppearance(theme.appearance),
            fontName: fontName,
            fontSize: fontSize,
            cursorStyle: cursorStyle,
            colors: theme.terminalPalette,
            isDeletable: !theme.isBuiltIn
        )
    }
}

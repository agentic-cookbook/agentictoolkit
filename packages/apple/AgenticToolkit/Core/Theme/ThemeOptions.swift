import Foundation

/// The caret's shape. Blinking is a separate setting rather than more cases,
/// because "block, blinking" is how the user thinks about it and SwiftTerm's
/// six-case `CursorStyle` is an encoding detail (`srp`).
///
/// This lives in Core, not with the terminal feature, because a `ColorTheme`
/// carries one (see `ThemeTerminalOptions`) and Core is Foundation-only. The
/// mapping onto SwiftTerm's `CursorStyle` stays in the macOS framework, which
/// is the only place that knows SwiftTerm exists.
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
}

/// A theme's optional terminal overrides.
///
/// Every field is optional and `nil` means "whatever the Terminal settings
/// panel says". That is the whole design: a theme starts with no opinion about
/// padding, font or caret, and only acquires one for the fields the user
/// actually edits — so switching themes doesn't silently rewrite terminal
/// settings the user never touched (`principle-of-least-astonishment`).
public struct ThemeTerminalOptions: Codable, Equatable, Sendable {
    public var paddingTop: Int?
    public var paddingLeading: Int?
    public var paddingBottom: Int?
    public var paddingTrailing: Int?
    /// PostScript font name — the picker's whole point is telling
    /// `FiraCode Nerd Font Mono` from `FiraCode Nerd Font Propo`, which a
    /// family name cannot.
    public var fontName: String?
    public var fontSize: Double?
    public var cursorShape: TerminalCursorShape?
    public var cursorBlinks: Bool?

    public init(
        paddingTop: Int? = nil,
        paddingLeading: Int? = nil,
        paddingBottom: Int? = nil,
        paddingTrailing: Int? = nil,
        fontName: String? = nil,
        fontSize: Double? = nil,
        cursorShape: TerminalCursorShape? = nil,
        cursorBlinks: Bool? = nil
    ) {
        self.paddingTop = paddingTop
        self.paddingLeading = paddingLeading
        self.paddingBottom = paddingBottom
        self.paddingTrailing = paddingTrailing
        self.fontName = fontName
        self.fontSize = fontSize
        self.cursorShape = cursorShape
        self.cursorBlinks = cursorBlinks
    }

    /// True when the theme has no terminal opinion at all — the state every
    /// theme starts in, and the one a "use the defaults" reset returns it to.
    public var isEmpty: Bool {
        paddingTop == nil && paddingLeading == nil && paddingBottom == nil
            && paddingTrailing == nil && fontName == nil && fontSize == nil
            && cursorShape == nil && cursorBlinks == nil
    }
}

/// A theme's optional overrides for the project window's chrome.
///
/// Same contract as `ThemeTerminalOptions`: `nil` means "whatever the Projects
/// settings panel says". The *switch* (outline the active pane at all) lives in
/// settings because it is a working preference; a theme overrides it, and picks
/// the color, because that is an appearance decision.
public struct ThemeProjectOptions: Codable, Equatable, Sendable {
    /// Overrides `UserSettings.highlightActivePane`.
    public var highlightActivePane: Bool?
    /// The active pane's border color. `nil` uses the theme's raised-surface
    /// tone, which is what the app draws when no theme has an opinion.
    public var paneOutline: RGBAColor?

    public init(highlightActivePane: Bool? = nil, paneOutline: RGBAColor? = nil) {
        self.highlightActivePane = highlightActivePane
        self.paneOutline = paneOutline
    }

    public var isEmpty: Bool { highlightActivePane == nil && paneOutline == nil }
}

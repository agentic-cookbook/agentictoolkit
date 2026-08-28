import SwiftUI
import AgenticToolkitCore

/// SwiftUI accessors for a `SemanticPalette`, mirroring the AppKit ones in
/// `SemanticPalette+NSColor.swift` role for role.
///
/// The toolkit is AppKit-first, so this exists for the handful of screens that
/// are genuinely SwiftUI (the system-window explorer, the file browser, some
/// settings tabs). Both sides resolve through the same `RGBAColor`, so a role
/// cannot mean two different colors depending on which framework asked.
///
/// Reached through `palette.swiftUI` rather than as overloads on the palette
/// itself: `color(_:)` and `font(_:)` already exist returning `RGBAColor` and
/// `NSFont`, and adding SwiftUI-returning twins would make every unannotated
/// call site ambiguous.
public struct SwiftUIPalette: Equatable, Sendable {

    private let palette: SemanticPalette

    fileprivate init(_ palette: SemanticPalette) {
        self.palette = palette
    }

    /// The SwiftUI `Color` for `role`, in the sRGB color space.
    public func color(_ role: ThemeRole) -> Color {
        let rgba = palette.color(role)
        return Color(.sRGB, red: rgba.red, green: rgba.green, blue: rgba.blue, opacity: rgba.alpha)
    }

    /// The resolved SwiftUI `Font` for a `TextRole`, per the theme's typography.
    public func font(_ role: TextRole) -> Font {
        Font(palette.font(role))
    }

    public var windowBackground: Color { color(.windowBackground) }
    public var surface: Color { color(.surface) }
    public var elevatedSurface: Color { color(.elevatedSurface) }
    public var controlBackground: Color { color(.controlBackground) }
    public var primaryText: Color { color(.primaryText) }
    public var secondaryText: Color { color(.secondaryText) }
    public var tertiaryText: Color { color(.tertiaryText) }
    public var placeholderText: Color { color(.placeholderText) }
    public var onAccentText: Color { color(.onAccentText) }
    public var accent: Color { color(.accent) }
    public var success: Color { color(.success) }
    public var warning: Color { color(.warning) }
    public var danger: Color { color(.danger) }
    public var info: Color { color(.info) }
    public var border: Color { color(.border) }
    public var outline: Color { color(.outline) }
    public var divider: Color { color(.divider) }
    public var selection: Color { color(.selection) }
    public var selectionText: Color { color(.selectionText) }
    public var cursor: Color { color(.cursor) }

    /// The 16 ANSI colors, for previews and series palettes.
    public var ansi: [Color] {
        palette.theme.ansi.map { Color(.sRGB, red: $0.red, green: $0.green, blue: $0.blue, opacity: $0.alpha) }
    }

    /// Visually distinct series colors that all clear `surface` — the SwiftUI
    /// twin of `SemanticPalette.chartSeriesColors`.
    public var chartSeries: [Color] {
        palette.chartSeriesColors.map { Color(.sRGB, red: $0.red, green: $0.green, blue: $0.blue, opacity: $0.alpha) }
    }

    /// The same name→role mapping as the AppKit `color(named:)`, so a
    /// caller-supplied color name resolves identically in either framework.
    public func color(named name: String?) -> Color? {
        switch name {
        case "red":               return danger
        case "yellow":            return warning
        case "green":             return success
        case "orange":            return warning
        case "blue":              return accent
        case "purple":            return info
        case "gray", "secondary": return secondaryText
        default:                  return nil
        }
    }
}

extension SemanticPalette {
    /// This palette's roles as SwiftUI `Color`s and `Font`s.
    public var swiftUI: SwiftUIPalette { SwiftUIPalette(self) }
}

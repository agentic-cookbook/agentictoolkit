import AppKit
import AgenticToolkitCore

/// AppKit accessors for a `SemanticPalette`. Lives in `AgenticToolkitCoreMacOS`
/// (next to the `RGBAColor`↔`NSColor` bridge it reuses) so the Foundation-only
/// `AgenticToolkitCore` stays AppKit-free.
extension SemanticPalette {

    /// The `NSColor` for `role`, in the sRGB color space.
    public func nsColor(_ role: ThemeRole) -> NSColor {
        NSColor(color(role))
    }

    public var windowBackgroundColor: NSColor { nsColor(.windowBackground) }
    public var surfaceColor: NSColor { nsColor(.surface) }
    public var elevatedSurfaceColor: NSColor { nsColor(.elevatedSurface) }
    public var controlBackgroundColor: NSColor { nsColor(.controlBackground) }
    public var primaryTextColor: NSColor { nsColor(.primaryText) }
    public var secondaryTextColor: NSColor { nsColor(.secondaryText) }
    public var tertiaryTextColor: NSColor { nsColor(.tertiaryText) }
    public var placeholderTextColor: NSColor { nsColor(.placeholderText) }
    public var onAccentTextColor: NSColor { nsColor(.onAccentText) }
    public var accentColor: NSColor { nsColor(.accent) }
    public var successColor: NSColor { nsColor(.success) }
    public var warningColor: NSColor { nsColor(.warning) }
    public var dangerColor: NSColor { nsColor(.danger) }
    public var infoColor: NSColor { nsColor(.info) }
    public var borderColor: NSColor { nsColor(.border) }
    public var outlineColor: NSColor { nsColor(.outline) }
    public var dividerColor: NSColor { nsColor(.divider) }
    public var selectionColor: NSColor { nsColor(.selection) }
    public var selectionTextColor: NSColor { nsColor(.selectionText) }
    public var cursorColor: NSColor { nsColor(.cursor) }

    /// The 16 ANSI colors as `NSColor`s (for chart series, terminal previews, etc.).
    public var ansiColors: [NSColor] {
        theme.ansi.map { NSColor($0) }
    }

    /// Maps a server-supplied color *name* (e.g. `"red"`, `"orange"`, `"gray"`)
    /// onto a themed semantic color. Single source of truth shared by the Usage
    /// views so the name→role mapping cannot drift between them. (`"orange"` and
    /// `"yellow"` both map to `warning` — the palette has no separate orange role.)
    public func color(named name: String?) -> NSColor? {
        switch name {
        case "red":               return dangerColor
        case "yellow":            return warningColor
        case "green":             return successColor
        case "orange":            return warningColor
        case "blue":              return accentColor
        case "purple":            return infoColor
        case "gray", "secondary": return secondaryTextColor
        default:                  return nil
        }
    }
}

import Foundation

/// Errors thrown while parsing an iTerm2 `.itermcolors` file.
public enum ITermColorsParseError: Error, Equatable {
    /// The file was not a property-list dictionary.
    case notADictionary
    /// A required color key (e.g. `"Foreground Color"` or `"Ansi 5 Color"`) was absent.
    case missingColor(String)
    /// A required RGB component was absent inside a color dictionary.
    case missingComponent(colorKey: String, component: String)
    /// Foreground and background are identical, so the theme renders all text
    /// invisible — rejected rather than imported into an unusable state.
    case foregroundMatchesBackground
}

/// Parses iTerm2 `.itermcolors` files into a `ColorTheme`.
///
/// An `.itermcolors` file is an XML property list whose top-level dictionary maps
/// color keys (`"Ansi 0 Color"` … `"Ansi 15 Color"`, `"Foreground Color"`,
/// `"Background Color"`, `"Cursor Color"`, `"Selection Color"`, …) to dictionaries
/// of `Red/Green/Blue/Alpha Component` reals in 0…1. Foundation parses plists
/// natively, so this needs zero third-party dependencies.
public enum ITermColorsParser {

    /// Parses `.itermcolors` data into a `ColorTheme`.
    ///
    /// - Parameters:
    ///   - data: Raw `.itermcolors` (XML or binary plist) bytes.
    ///   - name: Display name for the resulting theme.
    ///   - id: Stable identifier (defaults to a fresh UUID).
    ///   - appearance: Dark/light classification. When `nil` (the default) it is
    ///     inferred from the background color's luminance.
    /// - Throws: `ITermColorsParseError` when the structure is malformed or a
    ///   required color/component is missing (fail-fast).
    public static func parse(
        data: Data,
        name: String,
        id: String = UUID().uuidString,
        appearance: ThemeAppearance? = nil
    ) throws -> ColorTheme {
        let object = try PropertyListSerialization.propertyList(from: data, options: [], format: nil)
        guard let dict = object as? [String: Any] else {
            throw ITermColorsParseError.notADictionary
        }

        let foreground = try color(in: dict, forKey: "Foreground Color")
        let background = try color(in: dict, forKey: "Background Color")
        guard foreground != background else {
            throw ITermColorsParseError.foregroundMatchesBackground
        }

        var ansi: [RGBAColor] = []
        ansi.reserveCapacity(ColorTheme.ansiColorCount)
        for index in 0..<ColorTheme.ansiColorCount {
            ansi.append(try color(in: dict, forKey: "Ansi \(index) Color"))
        }

        // Cursor and selection are common but not universal; fall back to sensible
        // palette-derived values so partial files still produce a usable theme.
        let cursor = (try? color(in: dict, forKey: "Cursor Color")) ?? foreground
        let selection = (try? color(in: dict, forKey: "Selection Color"))
            ?? background.blended(withFraction: 0.25, of: foreground)

        let resolvedAppearance = appearance ?? (background.isDark ? .dark : .light)

        return ColorTheme(
            id: id,
            name: name,
            appearance: resolvedAppearance,
            isBuiltIn: false,
            foreground: foreground,
            background: background,
            cursor: cursor,
            selection: selection,
            ansi: ansi
        )
    }

    /// Parses an `.itermcolors` file at `url`. The theme name defaults to the
    /// file's base name (e.g. `Dracula.itermcolors` → `"Dracula"`).
    public static func parse(
        contentsOf url: URL,
        name: String? = nil,
        id: String = UUID().uuidString,
        appearance: ThemeAppearance? = nil
    ) throws -> ColorTheme {
        let data = try Data(contentsOf: url)
        let resolvedName = name ?? url.deletingPathExtension().lastPathComponent
        return try parse(data: data, name: resolvedName, id: id, appearance: appearance)
    }

    // MARK: - Component decoding

    private static func color(in dict: [String: Any], forKey key: String) throws -> RGBAColor {
        guard let components = dict[key] as? [String: Any] else {
            throw ITermColorsParseError.missingColor(key)
        }
        let red = try component(components, "Red Component", colorKey: key)
        let green = try component(components, "Green Component", colorKey: key)
        let blue = try component(components, "Blue Component", colorKey: key)
        // Alpha is frequently omitted; default to fully opaque.
        let alpha = (components["Alpha Component"] as? Double) ?? 1.0
        return RGBAColor(red: red, green: green, blue: blue, alpha: alpha)
    }

    private static func component(
        _ components: [String: Any],
        _ name: String,
        colorKey: String
    ) throws -> Double {
        guard let value = components[name] as? Double else {
            throw ITermColorsParseError.missingComponent(colorKey: colorKey, component: name)
        }
        return value
    }
}

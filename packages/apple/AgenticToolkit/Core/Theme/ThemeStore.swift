import Foundation

/// The catalog of available themes: the built-ins concatenated with the user's
/// imported/custom themes, plus mutators that persist custom themes through
/// `UserSettings.customThemes`. Pure logic (no AppKit) so it lives in Core and
/// is straightforward to test.
@MainActor
public final class ThemeStore {

    public init() {}

    /// User-imported/custom themes (persisted), in insertion order.
    public var customThemes: [ColorTheme] { UserSettings.customThemes.value }

    /// All selectable themes: built-ins first, then custom.
    public var allThemes: [ColorTheme] { BuiltInThemes.all + customThemes }

    /// Looks up any theme (built-in or custom) by ID.
    public func theme(withID id: String) -> ColorTheme? {
        allThemes.first { $0.id == id }
    }

    /// True when `id` refers to a built-in (read-only) theme.
    public func isBuiltIn(id: String) -> Bool {
        BuiltInThemes.theme(withID: id) != nil
    }

    /// Appends a custom theme and persists it.
    @discardableResult
    public func add(_ theme: ColorTheme) -> ColorTheme {
        UserSettings.customThemes.value = customThemes + [theme]
        return theme
    }

    /// Replaces a custom theme with the same ID (no-op for built-ins / unknown IDs).
    public func update(_ theme: ColorTheme) {
        var themes = customThemes
        guard let index = themes.firstIndex(where: { $0.id == theme.id }) else { return }
        themes[index] = theme
        UserSettings.customThemes.value = themes
    }

    /// Deletes the custom theme with `id` (no-op for built-ins).
    public func delete(id: String) {
        UserSettings.customThemes.value = customThemes.filter { $0.id != id }
    }

    /// Duplicates any theme (built-in or custom) into a fresh, editable custom theme.
    @discardableResult
    public func duplicate(_ theme: ColorTheme, nameSuffix: String = " Copy") -> ColorTheme {
        let copy = ColorTheme(
            id: UUID().uuidString,
            name: theme.name + nameSuffix,
            appearance: theme.appearance,
            isBuiltIn: false,
            foreground: theme.foreground,
            background: theme.background,
            cursor: theme.cursor,
            selection: theme.selection,
            ansi: theme.ansi,
            roleOverrides: theme.roleOverrides,
            typography: theme.typography
        )
        return add(copy)
    }

    /// Parses an `.itermcolors` file and stores it as a new custom theme.
    @discardableResult
    public func importITermColors(contentsOf url: URL) throws -> ColorTheme {
        let theme = try ITermColorsParser.parse(contentsOf: url)
        return add(theme)
    }
}

import Foundation

/// Theme-related user settings, shared by every host that adopts the theming
/// system (declared in `AgenticToolkitCore` so it has no AppKit dependency).
extension UserSettings {

    /// The active theme's `ColorTheme.id`. Defaults to Solarized Dark.
    public static var activeThemeID = UserSetting<String>(
        "theme.active_theme_id",
        default: BuiltInThemes.defaultID
    )

    /// User-imported and custom themes. Built-in themes are never stored here —
    /// `ThemeStore` concatenates them with `BuiltInThemes.all` at read time.
    public static var customThemes = UserSetting<[ColorTheme]>(
        "theme.custom_themes",
        default: []
    )
}

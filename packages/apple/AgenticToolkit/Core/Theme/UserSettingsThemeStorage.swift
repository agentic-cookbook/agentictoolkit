import Foundation

/// Backs ADT's theme store with AgenticToolkit's existing `UserSettings`, so
/// stored themes keep their current on-disk representation and nothing has to
/// migrate.
///
/// This is deliberately the *same* accessor `ThemeStore` used before the seam
/// existed — `UserSettings.customThemes`, key `theme.custom_themes`, a
/// JSON-encoded `[ColorTheme]` in whichever provider `UserSettings.shared`
/// holds. Reading and writing go through the identical code path, so themes
/// saved by an earlier build load unchanged. Changing the key or the encoding
/// here would silently orphan every theme a user has already saved.
@MainActor
public final class UserSettingsThemeStorage: ThemeStorage {

    public init() {}

    public var customThemes: [ColorTheme] {
        get { UserSettings.customThemes.value }
        set { UserSettings.customThemes.value = newValue }
    }
}

extension ThemeStore {

    /// The AgenticToolkit default: persist custom themes through `UserSettings`.
    /// Every existing `ThemeStore()` call site keeps working, and keeps reading
    /// the themes already on disk.
    public convenience init() {
        self.init(storage: UserSettingsThemeStorage())
    }
}

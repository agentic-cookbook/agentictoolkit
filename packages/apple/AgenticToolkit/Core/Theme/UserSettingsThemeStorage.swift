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

    public var onExternalChange: (() -> Void)? {
        didSet { updateObservers() }
    }

    /// Fire `onExternalChange` on any change to either setting: a different
    /// theme selected, or the active theme's own definition edited in place.
    /// Only allocated once someone actually sets `onExternalChange` — a
    /// `UserSettingsThemeStorage` nobody hooks (e.g. a `ThemeStore()` used
    /// without a `ThemeManager`) stays observer-free.
    private var activeObserver: UserSettingObserver<String>?
    private var customObserver: UserSettingObserver<[ColorTheme]>?

    public init() {}

    public var customThemes: [ColorTheme] {
        get { UserSettings.customThemes.value }
        set { UserSettings.customThemes.value = newValue }
    }

    /// Same rule as `customThemes`: the identical accessor `ThemeManager` used
    /// before the seam existed — `UserSettings.activeThemeID`, key
    /// `theme.active_theme_id`, a plain `String` defaulting to
    /// `BuiltInThemes.defaultID`. `UserSetting<String>` is non-optional, so a
    /// `nil` write falls back to that same default rather than storing `nil`.
    public var activeThemeID: String? {
        get { UserSettings.activeThemeID.value }
        set { UserSettings.activeThemeID.value = newValue ?? BuiltInThemes.defaultID }
    }

    private func updateObservers() {
        guard onExternalChange != nil else {
            activeObserver = nil
            customObserver = nil
            return
        }
        activeObserver = UserSettingObserver(UserSettings.activeThemeID) { [weak self] _ in
            self?.onExternalChange?()
        }
        customObserver = UserSettingObserver(UserSettings.customThemes) { [weak self] _ in
            self?.onExternalChange?()
        }
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

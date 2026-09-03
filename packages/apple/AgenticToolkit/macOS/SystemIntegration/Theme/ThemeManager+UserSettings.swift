import AgenticDeveloperToolkit
import AgenticDeveloperToolkitUI
import AgenticToolkitCore

/// `ThemeManager` itself moved to `AgenticDeveloperToolkitUI` (it depends on
/// nothing here — see that framework's `ThemeManager.swift`). What stays behind
/// is the one thing only this repo can supply: a zero-argument initializer
/// backed by `UserSettings`, so the app's `ThemeManager()` call site keeps
/// working unchanged and keeps reading the theme already on disk.
extension ThemeManager {

    /// The AgenticToolkit default: persist the active theme and custom themes
    /// through `UserSettings`. Every existing `ThemeManager()` call site keeps
    /// working, and keeps reading what's already on disk.
    ///
    /// The appearance driver is handed `UserSettings.appearanceMode` as what an
    /// `.auto` theme resolves to. A theme pinned to `.light` or `.dark` wins
    /// outright — its colours *are* that brightness, and forcing the opposite
    /// system appearance would put light system chrome against a dark themed
    /// surface. Only an `.auto` theme, which makes no claim, defers to the mode,
    /// which is why the Appearance panel's control still does something. The
    /// change itself arrives through `AppearanceManager`, which already observes
    /// that setting.
    public convenience init() {
        self.init(
            storage: UserSettingsThemeStorage(),
            appearanceDriver: AppKitAppearanceDriver(
                autoAppearance: { UserSettings.appearanceMode.currentValue.nsAppearance }))
    }
}

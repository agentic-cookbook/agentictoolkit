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
    public convenience init() {
        self.init(storage: UserSettingsThemeStorage())
    }
}

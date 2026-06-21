import AgenticToolkitCore

extension ComposableSettings {

    /// A `ChoiceViewModel` whose choices are all available themes (built-in plus
    /// custom), bound to `UserSettings.activeThemeID`. Selecting a choice changes
    /// the app-wide active theme.
    public final class ThemeChoiceViewModel: ChoiceViewModel<String> {

        public init(store: ThemeStore = ThemeStore(), title: String = "Theme") {
            super.init(
                title: title,
                setting: UserSettings.activeThemeID,
                choices: store.allThemes.map { .init(label: $0.name, value: $0.id) }
            )
        }
    }
}

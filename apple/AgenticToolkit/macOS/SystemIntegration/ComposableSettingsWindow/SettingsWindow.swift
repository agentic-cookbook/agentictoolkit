import AppKit

extension ComposableSettings {

    /// A reusable settings window controller. Subclass and override
    /// `makeSettingsPanels()` to compose the panels shown in the sidebar.
    ///
    /// ```swift
    /// final class AppSettingsWindowController: ComposableSettings.SettingsWindow {
    ///     override func makeSettingsPanels() -> [ComposableSettings.SettingsPanelViewController] {
    ///         [GeneralPanel(), AppearancePanel(), PluginsPanel()]
    ///     }
    /// }
    /// ```
    ///
    /// Panels are fetched lazily when the window loads, so any state the
    /// subclass needs to inject (managers, view models, configuration)
    /// can be set up before the first call to `showWindow()`.
    @MainActor
    open class SettingsWindow: WindowController<SplitViewController> {

        private static let windowID = "settings"

        public init() {
            super.init(windowID: Self.windowID, contentViewController: SplitViewController())
            self.windowTitle = "Settings"
            self.windowStyleMask = [.titled, .closable, .miniaturizable, .resizable]
        }

        public var settingPanels: [any ComposableSettingsPanel] {
            get { viewController?.panels ?? [] }
            set { viewController?.setPanels(newValue) }
        }
    }
}

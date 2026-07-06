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
            // Give the root topic list (and thus the settings panel) a visible title.
            self.viewController?.sidebarTitle = "Settings"
        }

        public var settingPanels: [any ComposableSettingsPanel] {
            get { viewController?.panels ?? [] }
            set { viewController?.setPanels(newValue) }
        }

        /// Unlike the menubar HUD windows — which deliberately order-front without
        /// activating the app — a settings window is opened to be *used* right
        /// away. Shown from an `LSUIElement` / menubar context, the base
        /// `showWindow()` leaves it visible on top but **non-key**, so its sidebar
        /// selection and text fields don't respond until the user clicks the
        /// window first. Activate the app and make the window key so it's
        /// immediately interactive (and drivable by UI automation).
        open override func showWindow() {
            super.showWindow()
            NSApp.activate(ignoringOtherApps: true)
            window?.makeKeyAndOrderFront(nil)
        }
    }
}

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

        /// Whether `showWindow()` activates the app and makes the window key. A
        /// settings window is normally opened to be *used* right away — and shown
        /// from an `LSUIElement` / menubar context the base `showWindow()` leaves it
        /// visible on top but **non-key**, so its sidebar selection and text fields
        /// don't respond until the user clicks it first. Defaults to `true` for that
        /// reason; a host that would rather not steal focus can override it to
        /// `false`, so this isn't forced on every consumer.
        open var activatesOnShow: Bool { true }

        /// Attaches the help drawer to the window and hands it to the root split.
        ///
        /// Deliberately deprecated: `HelpDrawerController` wraps `NSDrawer`, and
        /// naming it inside a deprecated declaration is what keeps the wrapper's
        /// deprecation from leaking outward. Nothing of ours calls this override —
        /// `loadWindow()` calls the base method — so the annotation warns nobody.
        @available(macOS, deprecated: 10.13, message: "Builds the NSDrawer-backed help presenter")
        open override func configureWindow(_ window: NSWindow) {
            super.configureWindow(window)
            viewController?.helpPresenter = HelpDrawerController(parentWindow: window)
        }

        open override func showWindow() {
            super.showWindow()
            guard activatesOnShow else { return }
            NSApp.activate(ignoringOtherApps: true)
            window?.makeKeyAndOrderFront(nil)
        }
    }
}

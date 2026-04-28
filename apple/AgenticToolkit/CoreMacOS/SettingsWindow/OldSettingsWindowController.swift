import AppKit

/// A reusable settings window controller. Subclass and override
/// `makeSettingsPanels()` to compose the panels shown in the sidebar.
///
/// ```swift
/// final class AppSettingsWindowController: OldSettingsWindowController {
///     override func makeSettingsPanels() -> [OldSettingsPanelViewController] {
///         [GeneralPanel(), AppearancePanel(), PluginsPanel()]
///     }
/// }
/// ```
///
/// Panels are fetched lazily when the window loads, so any state the
/// subclass needs to inject (managers, view models, configuration)
/// can be set up before the first call to `showWindow()`.
@MainActor
open class OldSettingsWindowController: SingleWindowController {

    public override init(windowID: String) {
        super.init(windowID: windowID)
    }

    public convenience init() {
        self.init(windowID: "settings")
    }

    open override var windowTitle: String { "Settings" }

    open override var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 720, height: 480)
    }

    open override var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .miniaturizable, .resizable]
    }

    open override func makeContentViewController() -> NSViewController? {
        let vc = OldSettingsViewController()
        for panel in makeSettingsPanels() {
            vc.addPanel(panel)
        }
        return vc
    }

    /// Override to compose the panels shown in the settings window. Called
    /// during `loadWindow()`, after subclass init has completed.
    open func makeSettingsPanels() -> [OldSettingsPanelViewController] { [] }
}

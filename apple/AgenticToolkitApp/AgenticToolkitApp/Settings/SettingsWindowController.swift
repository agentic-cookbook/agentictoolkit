import AppKit
import AgenticToolkitPluginSDK
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitChatWindow
import AgenticToolkitSettingsWindow

/// Hosts the new protocol-driven settings UI.
///
/// Opens an `NSWindow` whose content is a `SettingsViewController` populated
/// with a `SettingsPanelViewController` from each loaded plugin. Host-owned
/// panels (general/appearance/etc.) aren't wired yet — they can be added via
/// the same `addPanel(_:)` API once they're rebuilt as `SettingsPanelViewController`
/// conformers.
@MainActor
final class SettingsWindowController: NSObject, NSWindowDelegate {

    private var window: NSWindow?
    private var settingsVC: SettingsViewController?

    private var databaseManager: DatabaseManager?
    private var pluginManager: PluginManager?

    private(set) var viewModel: SettingsViewModel?

    // MARK: - Configuration

    /// Sets the database and plugin managers. Must be called before showing the window.
    func configure(databaseManager: DatabaseManager, pluginManager: PluginManager) {
        self.databaseManager = databaseManager
        self.pluginManager = pluginManager
    }

    /// Creates the host view model if it doesn't exist yet.
    func ensureViewModel() {
        guard viewModel == nil, let db = databaseManager, let pm = pluginManager else { return }
        let launchAtLoginManager = LaunchAtLoginManager(databaseManager: db)
        viewModel = SettingsViewModel(databaseManager: db, pluginManager: pm, launchAtLoginManager: launchAtLoginManager)
    }

    // MARK: - Show

    /// Shows the settings window. Creates it on first call.
    func showSettings() {
        if let window, window.isVisible == false || window.isVisible {
            NSApp.activate(ignoringOtherApps: true)
            window.makeKeyAndOrderFront(nil)
            return
        }

        guard let pluginManager else {
            Log.app.error("Cannot show settings without plugin manager")
            return
        }

        ensureViewModel()

        let settingsVC = SettingsViewController()
        self.settingsVC = settingsVC

        // Host-owned panels first, then the nested Plugins panel.
        if let vm = viewModel {
            settingsVC.addPanel(AppearanceSettingsPanelViewController(viewModel: vm))
            settingsVC.addPanel(ProfilesSettingsPanelViewController())
            settingsVC.addPanel(SystemSettingsPanelViewController(viewModel: vm))
        }
        settingsVC.addPanel(PluginsSettingsPanelViewController(pluginManager: pluginManager))

        let w = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 480),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        w.title = "AgenticPluginTester Settings"
        w.contentViewController = settingsVC
        w.center()
        w.delegate = self
        self.window = w

        NSApp.activate(ignoringOtherApps: true)
        w.makeKeyAndOrderFront(nil)
    }

    var isVisible: Bool { window?.isVisible ?? false }

    // Expose nothing for the old settings-view topic API; callers that used
    // `settingsView` should migrate to `settingsVC.selectPanel(...)` once the
    // selection API exists.
}

import AppKit
import AgenticPluginSDK
import AgenticUI

/// Manages the Settings window lifecycle. Creates the window lazily on first open,
/// hosts the AppKit SettingsView directly, and wires up the SettingsViewModel
/// callbacks to apply changes to the session panel in real time.
@MainActor
final class SettingsWindowController: NSObject, NSWindowDelegate {

    // MARK: - Properties

    /// The settings window instance (created lazily).
    private var window: NSWindow?

    /// The view model driving the settings UI.
    private(set) var viewModel: SettingsViewModel?

    /// The AI settings view model (shared with chat window).
    private(set) var aiSettingsViewModel: AISettingsViewModel?

    /// The database manager, held so the view model can be created.
    private var databaseManager: DatabaseManager?

    /// The plugin manager for AI provider access.
    private var pluginManager: PluginManager?

    // MARK: - Initialization

    override init() {}

    // MARK: - Configuration

    /// Sets the database and plugin managers. Must be called before showing the window.
    func configure(databaseManager: DatabaseManager, pluginManager: PluginManager) {
        self.databaseManager = databaseManager
        self.pluginManager = pluginManager
    }

    // MARK: - View Model

    /// Creates the SettingsViewModel and AISettingsViewModel if they don't exist yet.
    /// Called by AIChatWindowController when it needs the view model before the settings window is shown.
    func ensureViewModel() {
        guard viewModel == nil, let db = databaseManager, let pm = pluginManager else { return }
        let launchAtLoginManager = LaunchAtLoginManager(databaseManager: db)
        viewModel = SettingsViewModel(databaseManager: db, pluginManager: pm, launchAtLoginManager: launchAtLoginManager)

        if aiSettingsViewModel == nil {
            let persistence = DatabaseManagerPersistence(databaseManager: db)
            aiSettingsViewModel = AISettingsViewModel(pluginManager: pm, persistence: persistence)
        }
    }

    // MARK: - Show / Hide

    /// Shows the settings window. Creates it on first call.
    func showSettings() {
        if let window = window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        guard let databaseManager = databaseManager else {
            NSLog("AgenticToolkit: Cannot show settings without database manager")
            return
        }

        guard let pluginManager = pluginManager else {
            NSLog("AgenticToolkit: Cannot show settings without plugin manager")
            return
        }

        let launchAtLoginManager = LaunchAtLoginManager(databaseManager: databaseManager)
        let vm = SettingsViewModel(databaseManager: databaseManager, pluginManager: pluginManager, launchAtLoginManager: launchAtLoginManager)

        // Create AI settings view model
        let persistence = DatabaseManagerPersistence(databaseManager: databaseManager)
        let aiVM = AISettingsViewModel(pluginManager: pluginManager, persistence: persistence)
        self.aiSettingsViewModel = aiVM

        // Wire up callbacks so changes take effect immediately
        vm.onAppearanceModeChanged = { mode in
            switch mode {
            case "light": NSApp.appearance = NSAppearance(named: .aqua)
            case "dark": NSApp.appearance = NSAppearance(named: .darkAqua)
            default: NSApp.appearance = nil
            }
            Log.app.info("Appearance mode: \(mode, privacy: .public)")
        }

        self.viewModel = vm

        let settingsWindow = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 600, height: 480),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        settingsWindow.title = "AgenticToolkit Settings"
        settingsWindow.isReleasedWhenClosed = false
        settingsWindow.delegate = self

        let settingsView = SettingsView(viewModel: vm, aiSettingsViewModel: aiVM)
        settingsView.translatesAutoresizingMaskIntoConstraints = false
        let container = settingsWindow.contentView!
        container.addSubview(settingsView)
        NSLayoutConstraint.activate([
            settingsView.topAnchor.constraint(equalTo: container.topAnchor),
            settingsView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            settingsView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            settingsView.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        // Restore frame via proportional window manager
        WindowManager.shared.restoreFrame(for: settingsWindow, id: "settings")

        self.window = settingsWindow
        settingsWindow.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    /// Whether the settings window is currently visible.
    var isVisible: Bool {
        window?.isVisible ?? false
    }

    // MARK: - NSWindowDelegate

    func windowDidMove(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.saveFrame(for: window, id: "settings")
    }

    func windowDidResize(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.saveFrame(for: window, id: "settings")
    }
}

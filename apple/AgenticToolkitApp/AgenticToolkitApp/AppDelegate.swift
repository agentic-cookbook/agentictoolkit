import AppKit
import ApplicationServices
import AgenticToolkitPluginSDK
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitChatWindow
import AgenticToolkitSettingsWindow

@MainActor
class AppDelegate: NSObject, NSApplicationDelegate {

    private var statusItem: NSStatusItem!
    private var databaseManager: DatabaseManager?
    private var pluginManager: PluginManager?
    private var ingestionManager: EventIngestionManager?
    private var hookInstaller: HookInstaller?
    private var livenessMonitor: SessionLivenessMonitor?
    private var notificationManager: NotificationManager?
    private var settingsWindowController = SettingsWindowController()
    private var aiChatWindowController = AIChatWindowController()
    private var permissionWalkthrough = PermissionWalkthrough()

    // MARK: - App Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        Log.app.info("AgenticPluginTester launching")

        // Register window specs
        registerWindowSpecs()

        // Set up menus
        setupMainMenu()
        setupMenuBar()

        // Run the permission walkthrough before switching to accessory mode
        // so the walkthrough window is visible (app still has dock icon).
        permissionWalkthrough.runIfNeeded { [weak self] in
            guard let self else { return }

            self.setupDatabase()

            NSApp.setActivationPolicy(.regular)
            self.setupAfterDatabase()
            self.installHooksIfNeeded()
            self.setupNotifications()
            self.setupIngestion()
            self.setupLivenessMonitor()
            Log.app.info("AgenticPluginTester launch complete — all subsystems initialized")
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        Log.app.info("AgenticPluginTester terminating")
        livenessMonitor?.stop()
        ingestionManager?.stop()
        Log.app.info("AgenticPluginTester shutdown complete")
    }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool {
        false
    }

    // MARK: - Window Specs

    private func registerWindowSpecs() {
        let wm = WindowManager.shared
        wm.startObservingScreenChanges()
        wm.register(id: "settings", spec: WindowSpec(
            defaultSize: NSSize(width: 600, height: 480),
            minSize: NSSize(width: 550, height: 420),
            defaultPosition: .center,
            persistsFrame: true
        ))
        wm.register(id: "aiChat", spec: WindowSpec(
            defaultSize: NSSize(width: 420, height: 520),
            minSize: NSSize(width: 320, height: 400),
            defaultPosition: .center,
            persistsFrame: true
        ))
    }

    // MARK: - Database

    private func setupDatabase() {
        do {
            databaseManager = try DatabaseManager()
            Log.app.info("Database initialized")
        } catch {
            Log.app.error("Failed to initialize database: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Post-Database Setup

    private func setupAfterDatabase() {
        guard let db = databaseManager else {
            Log.app.warning("Cannot setup — no database")
            return
        }

        // Initialize the plugin system
        let pm = PluginManager(appName: "AgenticPluginTester")
        // No plugins registered for now — per-plugin registration is pending.
        pm.discoverPlugins()
        self.pluginManager = pm
        Log.app.info("Plugin system initialized — \(pm.availablePlugins.count) plugins available")

        // Configure the standalone settings window
        settingsWindowController.configure(databaseManager: db, pluginManager: pm)

        // Apply saved appearance mode
        if let mode = try? db.getSetting(key: SettingsViewModel.appearanceModeKey) {
            applyAppearanceMode(mode)
        }

        // Show the AI chat window on launch
        aiChatWindowController.showWindow()

        Log.app.debug("Post-database setup complete")
    }

    // MARK: - Hooks

    private func installHooksIfNeeded() {
        hookInstaller = HookInstaller()
        guard let installer = hookInstaller else { return }

        // Always reinstall to pick up hook command updates
        _ = installer.uninstallHooks()
        let result = installer.installHooks()
        switch result {
        case .installed:
            Log.app.info("Hooks installed successfully")
        case .alreadyInstalled:
            Log.app.info("Hooks already installed")
        case .failed(let error):
            Log.app.error("Hook installation failed: \(error, privacy: .public)")
        }
    }

    // MARK: - Notifications

    private func setupNotifications() {
        guard let db = databaseManager else {
            Log.app.warning("Cannot setup notifications — no database")
            return
        }

        notificationManager = NotificationManager(databaseManager: db)
        notificationManager?.requestAuthorization()
        Log.app.debug("Notification manager configured")
    }

    // MARK: - Ingestion

    private func setupIngestion() {
        guard let db = databaseManager else {
            Log.app.warning("Cannot start ingestion — no database")
            return
        }

        ingestionManager = EventIngestionManager(databaseManager: db)

        // Wire per-event callback for notifications
        ingestionManager?.onEventIngested = { [weak self] eventType, sessionId, projectName in
            guard let nm = self?.notificationManager else { return }
            switch eventType {
            case "SessionStart":
                nm.notifySessionStart(sessionId: sessionId, projectName: projectName)
            case "SessionEnd":
                nm.notifySessionEnd(sessionId: sessionId, projectName: projectName)
            default:
                break
            }
        }

        do {
            try ingestionManager?.start()
        } catch {
            Log.app.error("Failed to start event ingestion: \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Liveness Monitor

    private func setupLivenessMonitor() {
        guard let db = databaseManager else {
            Log.app.warning("Cannot start liveness monitor — no database")
            return
        }

        livenessMonitor = SessionLivenessMonitor(databaseManager: db)

        // Wire per-session stale callback for notifications
        livenessMonitor?.onSessionMarkedStale = { [weak self] sessionId, projectName in
            self?.notificationManager?.notifySessionStale(sessionId: sessionId, projectName: projectName)
        }

        // Wire per-session process-died callback for notifications
        livenessMonitor?.onSessionProcessDied = { [weak self] sessionId, projectName in
            self?.notificationManager?.notifySessionEnd(sessionId: sessionId, projectName: projectName)
        }

        livenessMonitor?.start()
    }

    // MARK: - Main Menu

    private func setupMainMenu() {
        let mainMenu = NSMenu()

        // App menu
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu()
        appMenuItem.submenu = appMenu

        appMenu.addItem(withTitle: "About AgenticPluginTester", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        let settingsItem = NSMenuItem(title: "Settings…", action: #selector(openSettings), keyEquivalent: ",")
        settingsItem.target = self
        appMenu.addItem(settingsItem)
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide AgenticPluginTester", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = NSMenuItem(title: "Hide Others", action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(hideOthers)
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit AgenticPluginTester", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        // File menu
        let fileMenuItem = NSMenuItem()
        mainMenu.addItem(fileMenuItem)
        let fileMenu = NSMenu(title: "File")
        fileMenuItem.submenu = fileMenu

        let closeItem = NSMenuItem(title: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        fileMenu.addItem(closeItem)

        // Edit menu
        let editMenuItem = NSMenuItem()
        mainMenu.addItem(editMenuItem)
        let editMenu = NSMenu(title: "Edit")
        editMenuItem.submenu = editMenu

        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")

        // View menu
        let viewMenuItem = NSMenuItem()
        mainMenu.addItem(viewMenuItem)
        let viewMenu = NSMenu(title: "View")
        viewMenuItem.submenu = viewMenu

        let toggleFullScreen = NSMenuItem(title: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        toggleFullScreen.keyEquivalentModifierMask = [.command, .control]
        viewMenu.addItem(toggleFullScreen)

        // Window menu
        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "Window")
        windowMenuItem.submenu = windowMenu

        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(.separator())

        let aiChatItem = NSMenuItem(title: "AI Chat", action: #selector(showAIChat), keyEquivalent: "2")
        aiChatItem.target = self
        windowMenu.addItem(aiChatItem)

        windowMenu.addItem(.separator())
        windowMenu.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")

        NSApp.windowsMenu = windowMenu

        // Help menu
        let helpMenuItem = NSMenuItem()
        mainMenu.addItem(helpMenuItem)
        let helpMenu = NSMenu(title: "Help")
        helpMenuItem.submenu = helpMenu
        NSApp.helpMenu = helpMenu

        NSApp.mainMenu = mainMenu
    }

    // MARK: - Status Item Menu

    private func setupMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "dog.fill", accessibilityDescription: "AgenticPluginTester")
            button.image?.size = NSSize(width: 18, height: 18)
            button.image?.isTemplate = true
        }

        let menu = NSMenu()

        let settingsItem = NSMenuItem(title: "Settings...", action: #selector(openSettings), keyEquivalent: "")
        settingsItem.target = self
        menu.addItem(settingsItem)

        let aiChatMenuItem = NSMenuItem(title: "AI Chat", action: #selector(showAIChat), keyEquivalent: "")
        aiChatMenuItem.target = self
        menu.addItem(aiChatMenuItem)

        menu.addItem(NSMenuItem.separator())

        let testItem = NSMenuItem(title: "Test Window Activation", action: #selector(testWindowActivation), keyEquivalent: "t")
        testItem.target = self
        menu.addItem(testItem)

        menu.addItem(NSMenuItem.separator())

        let quitItem = NSMenuItem(title: "Quit AgenticPluginTester", action: #selector(quitApp), keyEquivalent: "q")
        quitItem.target = self
        menu.addItem(quitItem)

        statusItem.menu = menu
        Log.app.debug("Menu bar configured")
    }

    // MARK: - Menu Actions

    @objc private func openSettings() {
        Log.ui.debug("Menu action: Settings")
        settingsWindowController.showSettings()
    }

    @objc private func showAIChat() {
        Log.ui.debug("Menu action: AI Chat")
        aiChatWindowController.showWindow()
    }

    @objc private func testWindowActivation() {
        Log.ui.debug("Menu action: Test Window Activation")
        guard let db = databaseManager else { return }

        // Build activation targets from live sessions.
        guard let sessions = try? db.fetchAllSessions() else {
            Log.ui.error("Failed to fetch sessions for activation test")
            return
        }
        let targets = sessions
            .filter { $0.status != .ended && $0.pid > 0 }
            .map {
                WindowActivationTarget(
                    identifier: $0.sessionId,
                    projectName: $0.projectName,
                    cwd: $0.cwd,
                    pid: $0.pid,
                    termProgram: $0.termProgram
                )
            }

        let log = ActivationTestLog(appSupportSubdirectory: "AgenticPluginTester")
        let tester = WindowActivationTester(targets: targets, log: log)
        let logPath = log.logPath

        DispatchQueue.global(qos: .userInitiated).async {
            tester.runAllTests()
            DispatchQueue.main.async {
                if let logPath {
                    NSWorkspace.shared.open(URL(fileURLWithPath: logPath))
                    Log.ui.info("Activation test complete — log at \(logPath)")
                } else {
                    Log.ui.info("Activation test complete — log was in-memory only")
                }
            }
        }
    }

    @objc private func quitApp() {
        Log.app.info("Menu action: Quit")
        NSApplication.shared.terminate(nil)
    }

    // MARK: - Cocoa Scripting Support

    // MARK: - Appearance

    private func applyAppearanceMode(_ mode: String) {
        switch mode {
        case "light":
            NSApp.appearance = NSAppearance(named: .aqua)
        case "dark":
            NSApp.appearance = NSAppearance(named: .darkAqua)
        default:
            NSApp.appearance = nil
        }
        Log.app.info("Appearance mode: \(mode, privacy: .public)")
    }
}

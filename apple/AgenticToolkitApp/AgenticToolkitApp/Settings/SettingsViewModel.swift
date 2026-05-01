import Foundation
import Combine
import os
import AgenticToolkitCore
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// View model for the Settings window. Reads and writes all configurable settings
/// to the SQLite `settings` table via sessionsDatabaseManager. Changes are persisted
/// immediately and take effect without requiring an app restart.
final class SettingsViewModel: ObservableObject {

    // MARK: - Settings Keys

    /// Key for the staleness timeout (seconds), also used by SessionLivenessMonitor.
    static let stalenessTimeoutKey = "staleness_timeout"

    /// Key for the launch-at-login setting.
    static let launchAtLoginKey = LaunchAtLoginManager.launchAtLoginKey

    /// Key for tracking whether the first-launch prompt has been shown.
    static let launchAtLoginPromptShownKey = LaunchAtLoginManager.launchAtLoginPromptShownKey

    /// Key for the always-on-top toggle.
    static let alwaysOnTopKey = "always_on_top"

    /// Key for the window transparency value (0.3...1.0).
    static let transparencyKey = "window_transparency"

    /// Key for notification toggle: SessionStart events.
    static let notifySessionStartKey = "notify_session_start"

    /// Key for notification toggle: SessionEnd events.
    static let notifySessionEndKey = "notify_session_end"

    /// Key for notification toggle: Stale events.
    static let notifyStaleKey = "notify_stale"

    /// Key for the appearance mode ("light", "dark", "auto").
    static let appearanceModeKey = "appearance_mode"

    /// Key for the text size offset from system default.
    static let textSizeKey = "text_size"

    /// Key for the dock icon visibility setting.
    static let showDockIconKey = "show_dock_icon"

    // MARK: - Default Values

    static let defaultStalenessTimeout: Double = 60
    static let defaultAlwaysOnTop: Bool = true
    static let defaultTransparency: Double = 1.0
    static let defaultNotifySessionStart: Bool = false
    static let defaultNotifySessionEnd: Bool = false
    static let defaultNotifyStale: Bool = false
    static let defaultLaunchAtLogin: Bool = false
    static let defaultAppearanceMode: String = "auto"
    static let defaultTextSize: Double = 0.0

    // MARK: - Published Properties

    /// Staleness timeout in seconds (30...600).
    @Published var stalenessTimeout: Double {
        didSet { saveSetting(key: Self.stalenessTimeoutKey, value: String(Int(stalenessTimeout))) }
    }

    /// Whether the session panel floats above all other windows.
    @Published var alwaysOnTop: Bool {
        didSet {
            saveSetting(key: Self.alwaysOnTopKey, value: alwaysOnTop ? "true" : "false")
            onAlwaysOnTopChanged?(alwaysOnTop)
        }
    }

    /// Window transparency (0.3...1.0).
    @Published var transparency: Double {
        didSet {
            let clamped = min(max(transparency, 0.3), 1.0)
            if clamped != transparency { transparency = clamped; return }
            saveSetting(key: Self.transparencyKey, value: String(format: "%.2f", transparency))
            onTransparencyChanged?(CGFloat(transparency))
        }
    }

    /// Whether to send a notification on SessionStart events.
    @Published var notifySessionStart: Bool {
        didSet { saveSetting(key: Self.notifySessionStartKey, value: notifySessionStart ? "true" : "false") }
    }

    /// Whether to send a notification on SessionEnd events.
    @Published var notifySessionEnd: Bool {
        didSet { saveSetting(key: Self.notifySessionEndKey, value: notifySessionEnd ? "true" : "false") }
    }

    /// Whether to send a notification when a session becomes stale.
    @Published var notifyStale: Bool {
        didSet { saveSetting(key: Self.notifyStaleKey, value: notifyStale ? "true" : "false") }
    }

    /// Whether the app is registered to launch at login. Reads the actual system
    /// state from SMAppService and toggles it via LaunchAtLoginManager.
    @Published var launchAtLogin: Bool {
        didSet {
            guard let manager = launchAtLoginManager else { return }
            // Only call setEnabled when the toggle actually differs from system state
            guard launchAtLogin != manager.isEnabled else { return }
            do {
                try manager.setEnabled(launchAtLogin)
            } catch {
                let action = self.launchAtLogin ? "enable" : "disable"
                logger.error("Failed to \(action, privacy: .public) launch at login: \(error.localizedDescription, privacy: .public)")
                // Revert to actual state on failure (suppress re-trigger of didSet)
                let actual = manager.isEnabled
                if actual != launchAtLogin {
                    launchAtLogin = actual
                }
            }
        }
    }

    /// Whether to show the first-launch prompt explaining launch-at-login.
    @Published var shouldShowLaunchAtLoginPrompt: Bool = false

    /// Appearance mode: "light", "dark", or "auto".
    @Published var appearanceMode: String = "auto" {
        didSet {
            saveSetting(key: Self.appearanceModeKey, value: appearanceMode)
            onAppearanceModeChanged?(appearanceMode)
        }
    }

    /// Text size offset from system default (range -4...4). 0.0 means system default.
    @Published var textSize: Double = 0.0 {
        didSet {
            saveSetting(key: Self.textSizeKey, value: String(textSize))
            onTextSizeChanged?(textSize)
        }
    }

    // MARK: - Plugin Access

    /// The plugin manager providing access to all registered plugins.
    let pluginManager: AIPluginManager

    // MARK: - Callbacks

    /// Called when the always-on-top setting changes so the panel controller can update.
    var onAlwaysOnTopChanged: ((Bool) -> Void)?

    /// Called when the transparency setting changes so the panel controller can update.
    var onTransparencyChanged: ((CGFloat) -> Void)?

    /// Called when the appearance mode changes so the app delegate can update NSApp.appearance.
    var onAppearanceModeChanged: ((String) -> Void)?

    /// Called when the text size changes.
    var onTextSizeChanged: ((Double) -> Void)?

    // MARK: - Properties

    private let sessionsDatabaseManager: SessionsDatabaseManager

    /// The launch-at-login manager. Nil until configured via `configureLaunchAtLogin`.
    private(set) var launchAtLoginManager: LaunchAtLoginManager?

    /// Suppresses didSet saves during init to avoid overwriting persisted values.
    private var isLoading = true

    // MARK: - Initialization

    init(
        sessionsDatabaseManager: SessionsDatabaseManager,
        pluginManager: AIPluginManager,
        launchAtLoginManager: LaunchAtLoginManager? = nil
    ) {
        self.sessionsDatabaseManager = sessionsDatabaseManager
        self.pluginManager = pluginManager
        self.launchAtLoginManager = launchAtLoginManager

        // Load initial values from database (use defaults if not set)
        self.stalenessTimeout = Self.defaultStalenessTimeout
        self.alwaysOnTop = Self.defaultAlwaysOnTop
        self.transparency = Self.defaultTransparency
        self.notifySessionStart = Self.defaultNotifySessionStart
        self.notifySessionEnd = Self.defaultNotifySessionEnd
        self.notifyStale = Self.defaultNotifyStale
        self.launchAtLogin = Self.defaultLaunchAtLogin
        self.appearanceMode = Self.defaultAppearanceMode
        self.textSize = Self.defaultTextSize
        loadFromDatabase()
        isLoading = false
    }

    /// Configures the launch-at-login manager after initialization.
    /// Call this to enable the launch-at-login toggle in settings.
    func configureLaunchAtLogin(_ manager: LaunchAtLoginManager) {
        self.launchAtLoginManager = manager
        // Sync the toggle with the actual system state
        self.launchAtLogin = manager.isEnabled
        // Check if we should show the first-launch prompt
        self.shouldShowLaunchAtLoginPrompt = !manager.hasShownPrompt
    }

    // MARK: - Load

    /// Loads all settings from the database, falling back to defaults for missing keys.
    func loadFromDatabase() {
        do {
            let settings = try sessionsDatabaseManager.fetchAllSettings()

            if let value = settings[Self.stalenessTimeoutKey], let seconds = Double(value), seconds > 0 {
                stalenessTimeout = seconds
            }

            if let value = settings[Self.alwaysOnTopKey] {
                alwaysOnTop = value == "true"
            }

            if let value = settings[Self.transparencyKey], let alpha = Double(value) {
                transparency = min(max(alpha, 0.3), 1.0)
            }

            if let value = settings[Self.notifySessionStartKey] {
                notifySessionStart = value == "true"
            }

            if let value = settings[Self.notifySessionEndKey] {
                notifySessionEnd = value == "true"
            }

            if let value = settings[Self.notifyStaleKey] {
                notifyStale = value == "true"
            }

            if let value = settings[Self.appearanceModeKey], ["light", "dark", "auto"].contains(value) {
                appearanceMode = value
            }

            if let value = settings[Self.textSizeKey], let size = Double(value) {
                textSize = min(max(size, -4), 4)
            }

            // Launch at login reads the actual system state, not the database
            if let manager = launchAtLoginManager {
                launchAtLogin = manager.isEnabled
                shouldShowLaunchAtLoginPrompt = !manager.hasShownPrompt
            }
        } catch {
            logger.error("Failed to load settings: \(error.localizedDescription)")
        }
    }

    // MARK: - Save

    /// Persists a single setting to the database.
    private func saveSetting(key: String, value: String) {
        guard !isLoading else { return }
        do {
            try sessionsDatabaseManager.setSetting(key: key, value: value)
        } catch {
            logger.error("Failed to save setting '\(key)': \(error.localizedDescription)")
        }
    }

    /// Saves the dock icon visibility setting.
    func saveDockIconSetting(_ showInDock: Bool) {
        saveSetting(key: Self.showDockIconKey, value: showInDock ? "true" : "false")
    }

    /// Whether the dock icon should be shown (reads from database).
    var showDockIcon: Bool {
        (try? sessionsDatabaseManager.getSetting(key: Self.showDockIconKey)) == "true"
    }

    // MARK: - Launch at Login Prompt

    /// Dismisses the first-launch prompt and marks it as shown.
    func dismissLaunchAtLoginPrompt() {
        shouldShowLaunchAtLoginPrompt = false
        launchAtLoginManager?.markPromptShown()
    }

    // MARK: - Formatted Display

    /// Returns the staleness timeout formatted for display (e.g., "1 minute", "5 minutes").
    var stalenessTimeoutDisplay: String {
        let seconds = Int(stalenessTimeout)
        if seconds < 60 {
            return "\(seconds) second\(seconds == 1 ? "" : "s")"
        }
        let minutes = seconds / 60
        let remainingSeconds = seconds % 60
        if remainingSeconds == 0 {
            return "\(minutes) minute\(minutes == 1 ? "" : "s")"
        }
        return "\(minutes)m \(remainingSeconds)s"
    }

}

extension SettingsViewModel: Loggable {
    public static nonisolated let logger = makeLogger()
}

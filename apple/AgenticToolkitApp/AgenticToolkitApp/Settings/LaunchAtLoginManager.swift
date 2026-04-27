import AgenticToolkitCore
import Foundation
import OSLog
import ServiceManagement

/// Protocol abstracting SMAppService for testability.
/// In production, `SMAppService.mainApp` provides the real implementation.
protocol LaunchAtLoginServiceProtocol {
    /// The current registration status of the app service.
    var status: SMAppService.Status { get }

    /// Registers the app to launch at login.
    func register() throws

    /// Unregisters the app from launching at login.
    func unregister() throws
}

/// Conform the real SMAppService to our protocol.
extension SMAppService: LaunchAtLoginServiceProtocol {}

/// Manages the "Launch at Login" feature using SMAppService (macOS 13+).
///
/// Provides a clean interface for the settings UI to toggle launch-at-login
/// and accurately reflect the current system registration state. Uses a protocol
/// abstraction over SMAppService for unit testing.
final class LaunchAtLoginManager {

    // MARK: - Settings Keys

    /// Key for the launch-at-login setting in the database.
    /// Also used to track whether the first-launch prompt has been shown.
    static let launchAtLoginKey = "launch_at_login"

    /// Key for tracking whether the first-launch prompt has been shown.
    static let launchAtLoginPromptShownKey = "launch_at_login_prompt_shown"

    // MARK: - Properties

    private let service: LaunchAtLoginServiceProtocol
    private let SessionsDatabaseManager: SessionsDatabaseManager

    // MARK: - Initialization

    /// Creates a LaunchAtLoginManager.
    /// - Parameters:
    ///   - SessionsDatabaseManager: The database manager for persisting settings.
    ///   - service: The app service to use. Defaults to `SMAppService.mainApp`.
    init(SessionsDatabaseManager: SessionsDatabaseManager, service: LaunchAtLoginServiceProtocol? = nil) {
        self.SessionsDatabaseManager = SessionsDatabaseManager
        self.service = service ?? SMAppService.mainApp
    }

    // MARK: - State

    /// Whether the app is currently registered to launch at login,
    /// based on the actual system state via SMAppService.
    var isEnabled: Bool {
        service.status == .enabled
    }

    /// Whether the first-launch prompt has already been shown.
    var hasShownPrompt: Bool {
        do {
            if let value = try SessionsDatabaseManager.getSetting(key: Self.launchAtLoginPromptShownKey) {
                return value == "true"
            }
        } catch {
            logger.warning("Failed to read launch-at-login prompt state: \(error.localizedDescription, privacy: .public)")
        }
        return false
    }

    // MARK: - Toggle

    /// Enables or disables launch at login.
    /// - Parameter enabled: Whether to register or unregister the app.
    /// - Throws: An error if the registration or unregistration fails.
    func setEnabled(_ enabled: Bool) throws {
        logger.info("Launch at login: \(enabled ? "enabling" : "disabling", privacy: .public)")
        if enabled {
            try service.register()
        } else {
            try service.unregister()
        }

        // Persist the setting
        do {
            try SessionsDatabaseManager.setSetting(key: Self.launchAtLoginKey, value: enabled ? "true" : "false")
        } catch {
            logger.error("Failed to persist launch-at-login setting: \(error.localizedDescription, privacy: .public)")
        }
    }

    /// Marks the first-launch prompt as shown.
    func markPromptShown() {
        do {
            try SessionsDatabaseManager.setSetting(key: Self.launchAtLoginPromptShownKey, value: "true")
        } catch {
            logger.warning("Failed to persist launch-at-login prompt state: \(error.localizedDescription, privacy: .public)")
        }
    }
}

extension LaunchAtLoginManager: Loggable {
    public static nonisolated let logger = makeLogger()
}

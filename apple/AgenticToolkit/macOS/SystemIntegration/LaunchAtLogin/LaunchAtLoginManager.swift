import Foundation
import OSLog
import ServiceManagement
import AgenticToolkitCore

/// Protocol abstracting SMAppService for testability.
/// In production, `SMAppService.mainApp` provides the real implementation.
public protocol LaunchAtLoginServiceProtocol {
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
@MainActor
public class LaunchAtLoginManager {

    // MARK: - Properties

    private let service: LaunchAtLoginServiceProtocol

//    public static var settingsKey = any StorableSetting<Value>("launch_at_login", default: true)
//    
//    @StoredSetting static var launchAtLoginPromptShown = StoredSetting("launch_at_login_prompt_shown", default: true)
//    
//    /// Whether the first-launch prompt for "launch at login" has been shown.
//    static var launchAtLoginPromptShown: any StorableSetting<Value> {
//        .init("launch_at_login_prompt_shown", default: false)
//    }

    // MARK: - Initialization

    /// Creates a LaunchAtLoginManager.
    /// - Parameters:
    ///   - settingsStore: The settings store for persisting state. Pass `SettingsStore.shared` from MainActor sites.
    ///   - service: The app service to use. Defaults to `SMAppService.mainApp`.
    public init(service: LaunchAtLoginServiceProtocol? = nil) {
        self.service = service ?? SMAppService.mainApp
    }

    // MARK: - State

    /// Whether the app is currently registered to launch at login,
    /// based on the actual system state via SMAppService.
    public var isEnabled: Bool {
        service.status == .enabled
    }

    /// Whether the first-launch prompt has already been shown.
    public var hasShownPrompt: Bool {
        UserSettings.launchAtLoginPromptShown.value
    }

    // MARK: - Toggle

    /// Enables or disables launch at login.
    /// - Parameter enabled: Whether to register or unregister the app.
    /// - Throws: An error if the registration or unregistration fails.
    public func setEnabled(_ enabled: Bool) throws {
        logger.info("Launch at login: \(enabled ? "enabling" : "disabling")")
        if enabled {
            try service.register()
        } else {
            try service.unregister()
        }
        UserSettings.launchAtLoginPromptShown.value = enabled
    }

    /// Marks the first-launch prompt as shown.
    public func markPromptShown() {
        UserSettings.launchAtLoginPromptShown.value = true
    }
}

extension LaunchAtLoginManager: Loggable {
    public static nonisolated let logger = makeLogger()
}

extension UserSettings {

    /// Whether the app launches at login.
    static public var launchAtLogin = UserSetting<Bool>("launchAtLogin", default: false)

    /// Whether the first-launch prompt for "launch at login" has been shown.
    static public var launchAtLoginPromptShown = UserSetting<Bool>("launchAtLoginPromptShown", default: false)

    static public var launchAtLoginHintDismissed = UserSetting<Bool>("launchAtLoginHintDismissed", default: false)
}


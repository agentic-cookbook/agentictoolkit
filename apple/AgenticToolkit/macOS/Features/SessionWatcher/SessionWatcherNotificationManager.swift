import Foundation
import UserNotifications
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import OSLog
import os

/// Protocol abstracting UNUserNotificationCenter for testability.
public protocol NotificationCenterProtocol: AnyObject {
    var delegate: (any UNUserNotificationCenterDelegate)? { get set }
    func requestAuthorization(options: UNAuthorizationOptions, completionHandler: @escaping @Sendable (Bool, (any Error)?) -> Void)
    func getNotificationSettings(completionHandler: @escaping @Sendable (UNNotificationSettings) -> Void)
    func setNotificationCategories(_ categories: Set<UNNotificationCategory>)
    func add(_ request: UNNotificationRequest, withCompletionHandler completionHandler: (@Sendable ((any Error)?) -> Void)?)
}

/// Conform the real UNUserNotificationCenter to our protocol.
extension UNUserNotificationCenter: NotificationCenterProtocol {}

extension SessionWatcher {
    /// Manages macOS notifications for Whippet session events.
    ///
    /// Responsibilities:
    /// - Requests notification authorization on first launch
    /// - Posts notifications for SessionStart, SessionEnd, and Stale events
    /// - Respects per-event-type toggles from the settings database
    /// - Handles notification click actions (brings floating window to front)
    @MainActor
    public class SessionWatcherNotificationManager: NSObject, UNUserNotificationCenterDelegate {

        // MARK: - Category Identifiers

        /// Notification category identifier for session events.
        public static let sessionCategoryIdentifier = "WHIPPET_SESSION_EVENT"

        // MARK: - User Info Keys

        /// Key for the session ID in the notification's userInfo dictionary.
        public static let sessionIdKey = "sessionId"

        /// Key for the event type in the notification's userInfo dictionary.
        public static let eventTypeKey = "eventType"

        // MARK: - Properties

        private let settingsStore: SettingsStore
        private let notificationCenter: NotificationCenterProtocol

        /// Whether the user has granted notification permission.
        private(set) var isAuthorized = false

        /// Callback invoked when the user taps a notification.
        /// The caller (AppDelegate) should bring the floating window to the front.
        public var onNotificationClicked: (() -> Void)?

        // MARK: - Initialization

        /// Creates a NotificationManager.
        /// - Parameters:
        ///   - settingsStore: The settings store for reading notification toggles. Defaults to the shared store.
        ///   - notificationCenter: The notification center to use. Defaults to `.current()`.
        public init(settingsStore: SettingsStore, notificationCenter: NotificationCenterProtocol? = nil) {
            self.settingsStore = settingsStore
            self.notificationCenter = notificationCenter ?? UNUserNotificationCenter.current()
            super.init()
            self.notificationCenter.delegate = self
            registerCategories()
        }

        // MARK: - Authorization

        /// Requests notification authorization with alert and sound options.
        /// Should be called once during app launch.
        public func requestAuthorization() {
            notificationCenter.requestAuthorization(options: [.alert, .sound]) { [weak self] granted, error in
                Task { @MainActor [weak self] in
                    self?.isAuthorized = granted
                    if let error = error {
                        Self.logger.error("Authorization error: \(error.localizedDescription, privacy: .public)")
                    } else {
                        Self.logger.info("Authorization \(granted ? "granted" : "denied", privacy: .public)")
                    }
                }
            }
        }

        /// Checks the current authorization status and updates `isAuthorized`.
        public func checkAuthorization(completion: (@Sendable (Bool) -> Void)? = nil) {
            notificationCenter.getNotificationSettings { [weak self] settings in
                let authorized = settings.authorizationStatus == .authorized
                Task { @MainActor [weak self] in
                    self?.isAuthorized = authorized
                    completion?(authorized)
                }
            }
        }

        // MARK: - Category Registration

        /// Registers notification categories so the system knows how to display them.
        private func registerCategories() {
            let category = UNNotificationCategory(
                identifier: Self.sessionCategoryIdentifier,
                actions: [],
                intentIdentifiers: []
            )
            notificationCenter.setNotificationCategories([category])
        }

        // MARK: - Posting Notifications

        /// Posts a notification for a SessionStart event if enabled in settings.
        /// - Parameters:
        ///   - sessionId: The session identifier.
        ///   - projectName: The derived project name from the working directory.
        public func notifySessionStart(sessionId: String, projectName: String) {
            guard isNotificationEnabled(UserSettings.notifySessionStart) else { return }

            let content = UNMutableNotificationContent()
            content.title = "Session Started"
            content.body = "\(projectName) - \(abbreviateSessionId(sessionId))"
            content.categoryIdentifier = Self.sessionCategoryIdentifier
            content.sound = .default
            content.userInfo = [
                Self.sessionIdKey: sessionId,
                Self.eventTypeKey: "SessionStart"
            ]

            postNotification(identifier: "session-start-\(sessionId)", content: content)
        }

        /// Posts a notification for a SessionEnd event if enabled in settings.
        /// - Parameters:
        ///   - sessionId: The session identifier.
        ///   - projectName: The derived project name from the working directory.
        public func notifySessionEnd(sessionId: String, projectName: String) {
            guard isNotificationEnabled(UserSettings.notifySessionEnd) else { return }

            let content = UNMutableNotificationContent()
            content.title = "Session Ended"
            content.body = "\(projectName) - \(abbreviateSessionId(sessionId))"
            content.categoryIdentifier = Self.sessionCategoryIdentifier
            content.sound = .default
            content.userInfo = [
                Self.sessionIdKey: sessionId,
                Self.eventTypeKey: "SessionEnd"
            ]

            postNotification(identifier: "session-end-\(sessionId)", content: content)
        }

        /// Posts a notification when a session becomes stale if enabled in settings.
        /// - Parameters:
        ///   - sessionId: The session identifier.
        ///   - projectName: The derived project name from the working directory.
        public func notifySessionStale(sessionId: String, projectName: String) {
            guard isNotificationEnabled(UserSettings.notifyStale) else { return }

            let content = UNMutableNotificationContent()
            content.title = "Session Stale"
            content.body = "\(projectName) - \(abbreviateSessionId(sessionId))"
            content.categoryIdentifier = Self.sessionCategoryIdentifier
            content.sound = .default
            content.userInfo = [
                Self.sessionIdKey: sessionId,
                Self.eventTypeKey: "Stale"
            ]

            postNotification(identifier: "session-stale-\(sessionId)", content: content)
        }

        // MARK: - UNUserNotificationCenterDelegate

        /// Called when a notification is delivered while the app is in the foreground.
        /// Delegate methods are invoked from non-MainActor contexts; mark them
        /// `nonisolated` and only the post-handler hop reaches MainActor state.
        public nonisolated func userNotificationCenter(
            _ center: UNUserNotificationCenter,
            willPresent notification: UNNotification,
            withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
        ) {
            // Show banner and play sound even when the app is in the foreground
            completionHandler([.banner, .sound])
        }

        /// Called when the user interacts with a notification (e.g., clicks it).
        public nonisolated func userNotificationCenter(
            _ center: UNUserNotificationCenter,
            didReceive response: UNNotificationResponse,
            withCompletionHandler completionHandler: @escaping () -> Void
        ) {
            // Bring the floating window to the front. Hop to MainActor before
            // touching any isolated state.
            Task { @MainActor [weak self] in
                Self.logger.debug("User clicked notification")
                self?.onNotificationClicked?()
            }
            completionHandler()
        }

        // MARK: - Helpers

        /// Checks whether notifications are enabled for the given typed Bool key.
        /// Returns `false` if the user has not granted authorization yet.
        public func isNotificationEnabled(_ key: UserSetting<Bool>) -> Bool {
            guard isAuthorized else { return false }
            return settingsStore.get(key)
        }

        /// Posts a notification request with the given identifier and content.
        private func postNotification(identifier: String, content: UNNotificationContent) {
            logger.debug("Posting notification: \(identifier, privacy: .public) — \(content.title, privacy: .public)")
            let request = UNNotificationRequest(
                identifier: identifier,
                content: content,
                trigger: nil // Deliver immediately
            )

            notificationCenter.add(request, withCompletionHandler: { error in
                if let error = error {
                    Self.logger.error("Failed to post notification '\(identifier, privacy: .public)': \(error.localizedDescription, privacy: .public)")
                }
            })
        }

        /// Abbreviates a session ID for display (first 8 characters).
        public func abbreviateSessionId(_ sessionId: String) -> String {
            if sessionId.count > 8 {
                return String(sessionId.prefix(8)) + "..."
            }
            return sessionId
        }
    }
}

extension SessionWatcher.SessionWatcherNotificationManager: Loggable {
    public static nonisolated let logger = makeLogger()
}

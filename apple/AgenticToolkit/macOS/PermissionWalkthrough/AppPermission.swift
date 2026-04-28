import AppKit
import ApplicationServices
import UserNotifications

// `kAXTrustedCheckOptionPrompt` is an imported C global which Swift 6
// strict-concurrency flags as not concurrency-safe. The literal CFString
// value of that constant is "AXTrustedCheckOptionPrompt"; using the literal
// avoids the global access entirely (the AX API just looks it up by string).
private let axTrustedCheckOptionPromptKey: String = "AXTrustedCheckOptionPrompt"

/// Enumerates the macOS permissions that Whippet requires to function.
public enum AppPermission: Int, CaseIterable, Sendable {
    case accessibility = 0
    case notifications = 1
    case automation = 2

    public var displayName: String {
        switch self {
        case .accessibility: return "Accessibility"
        case .notifications: return "Notifications"
        case .automation: return "Automation"
        }
    }

    public var systemImage: String {
        switch self {
        case .accessibility: return "hand.raised"
        case .notifications: return "bell.badge"
        case .automation: return "gearshape.2"
        }
    }

    public var explanation: String {
        switch self {
        case .accessibility:
            return "Required to discover and activate terminal windows for your Claude Code sessions."
        case .notifications:
            return "Allows Whippet to notify you when sessions start, end, or become stale."
        case .automation:
            return "Needed to open and focus terminal apps like iTerm2, Warp, and Terminal."
        }
    }

    public var settingsPath: String {
        switch self {
        case .accessibility:
            return "Settings → Privacy & Security → Accessibility"
        case .notifications:
            return "Settings → Notifications → Whippet"
        case .automation:
            return "Settings → Privacy & Security → Automation"
        }
    }

    /// Checks whether this permission is currently granted.
    public var isGranted: Bool {
        switch self {
        case .accessibility:
            return AXIsProcessTrusted()
        case .notifications:
            // Synchronous check — the actual async result is cached by NotificationManager,
            // but for the settings pane we do a synchronous snapshot.
            // The Box exists to ferry the result out of a @Sendable callback;
            // the semaphore enforces the happens-before, so the unchecked
            // Sendable conformance is safe.
            final class Box: @unchecked Sendable { var value = false }
            let box = Box()
            let semaphore = DispatchSemaphore(value: 0)
            UNUserNotificationCenter.current().getNotificationSettings { settings in
                box.value = settings.authorizationStatus == .authorized
                semaphore.signal()
            }
            // Timeout after 1 second to avoid blocking UI forever
            _ = semaphore.wait(timeout: .now() + 1)
            return box.value
        case .automation:
            // There's no direct API to check Automation permission.
            // We return true optimistically; if it fails at runtime, the error
            // handler in SessionWatcherActionHandler guides the user.
            return checkAutomationPermission()
        }
    }

    /// Opens the relevant System Settings pane for this permission.
    public func openSettings() {
        switch self {
        case .accessibility:
            let options = [axTrustedCheckOptionPromptKey: true] as CFDictionary
            AXIsProcessTrustedWithOptions(options)
        case .notifications:
            if let bundleId = Bundle.main.bundleIdentifier,
               let url = URL(string: "x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=\(bundleId)") {
                NSWorkspace.shared.open(url)
            }
        case .automation:
            if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation") {
                NSWorkspace.shared.open(url)
            }
        }
    }

    /// Requests this permission from the user. For accessibility, this shows
    /// the system prompt. For notifications, this triggers the authorization
    /// request. For automation, we open System Settings (no programmatic request).
    public func request(completion: @escaping @Sendable (Bool) -> Void) {
        switch self {
        case .accessibility:
            let options = [axTrustedCheckOptionPromptKey: true] as CFDictionary
            let trusted = AXIsProcessTrustedWithOptions(options)
            // AX prompt is async — the user has to toggle it in Settings.
            // Return current state; the caller should poll.
            completion(trusted)

        case .notifications:
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
                DispatchQueue.main.async { completion(granted) }
            }

        case .automation:
            // Can't request programmatically — open Settings and let user toggle.
            openSettings()
            completion(false)
        }
    }

    /// Attempts a lightweight AppleScript to check if Automation is permitted.
    private func checkAutomationPermission() -> Bool {
        // Try a harmless AppleScript targeting System Events (commonly needed).
        // If we get errAEEventNotPermitted (-1743), automation is denied.
        let script = NSAppleScript(source: "tell application \"System Events\" to return name of first process")
        var errorInfo: NSDictionary?
        script?.executeAndReturnError(&errorInfo)
        if let errorNumber = errorInfo?[NSAppleScript.errorNumber] as? Int, errorNumber == -1743 {
            return false
        }
        return true
    }
}

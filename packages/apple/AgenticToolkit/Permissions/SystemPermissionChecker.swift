import ApplicationServices
import CoreServices
import Foundation
import UserNotifications

/// Production `PermissionChecking` over the real macOS permission APIs.
///
/// The Apple Events probe is injected so the status mapping is testable; the
/// Accessibility and Notification checks are thin pass-throughs to the system
/// and are exercised only at runtime.
public struct SystemPermissionChecker: PermissionChecking {
    private let automationProbe: any AutomationProbing

    public init(automationProbe: any AutomationProbing = SystemAutomationProbe()) {
        self.automationProbe = automationProbe
    }

    public func status(_ permission: Permission) async -> PermissionStatus {
        switch permission {
        case .accessibility:
            return AXIsProcessTrusted() ? .granted : .denied
        case .notifications:
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            return Self.notificationStatus(settings.authorizationStatus)
        case .automation(let bundleID):
            let status = await automationStatus(forBundleID: bundleID, promptIfNeeded: false)
            return Self.automationStatus(status)
        }
    }

    @discardableResult
    public func request(_ permission: Permission) async -> PermissionStatus {
        switch permission {
        case .accessibility:
            // String-literal key rather than the SDK's global `kAXTrustedCheckOptionPrompt`
            // var, which is not concurrency-safe to reference.
            let options = ["AXTrustedCheckOptionPrompt": true] as CFDictionary
            return AXIsProcessTrustedWithOptions(options) ? .granted : .denied
        case .notifications:
            _ = try? await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound])
            return await status(permission)
        case .automation(let bundleID):
            let status = await automationStatus(forBundleID: bundleID, promptIfNeeded: true)
            return Self.automationStatus(status)
        }
    }

    /// Runs the synchronous, potentially long-blocking Apple Events probe on a GCD
    /// global queue rather than the calling context. With `promptIfNeeded: true`,
    /// `AEDeterminePermissionToAutomateTarget` blocks until the user dismisses the
    /// consent dialog; Apple's header warns against calling it on a thread you
    /// can't block arbitrarily. A cooperative (Swift concurrency) thread is exactly
    /// such a thread, so we hop to GCD — which spawns more threads as needed —
    /// instead of starving the cooperative pool.
    private func automationStatus(forBundleID bundleID: String, promptIfNeeded: Bool) async -> OSStatus {
        let probe = automationProbe
        return await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                continuation.resume(
                    returning: probe.permissionStatus(forBundleID: bundleID, promptIfNeeded: promptIfNeeded)
                )
            }
        }
    }

    /// Maps an `AEDeterminePermissionToAutomateTarget` status to a tri-state.
    /// `noErr` is granted; `errAEEventNotPermitted` (-1743) is a real denial;
    /// everything else — consent-required (-1744), target-not-running (-600), … —
    /// is `undetermined` (we can't prove granted *or* denied), so the UI doesn't
    /// mislabel a granted permission whose target app simply isn't running.
    static func automationStatus(_ status: OSStatus) -> PermissionStatus {
        switch status {
        case noErr:
            return .granted
        case OSStatus(errAEEventNotPermitted):
            return .denied
        default:
            return .undetermined
        }
    }

    /// Maps a `UNAuthorizationStatus` to a tri-state. `notDetermined` (never
    /// requested) is `undetermined`, not a denial.
    static func notificationStatus(_ status: UNAuthorizationStatus) -> PermissionStatus {
        switch status {
        case .authorized, .provisional, .ephemeral:
            return .granted
        case .denied:
            return .denied
        case .notDetermined:
            return .undetermined
        @unknown default:
            return .undetermined
        }
    }
}

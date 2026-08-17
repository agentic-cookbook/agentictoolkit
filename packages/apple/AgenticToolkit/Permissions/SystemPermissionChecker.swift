import ApplicationServices
import CoreLocation
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

    // A single long-lived manager: CLLocationManager reports authorization on
    // the instance, and a freshly allocated one can answer `.notDetermined`
    // before it has talked to the daemon. `CLLocationManager` is not `Sendable`,
    // but its `authorizationStatus` reads and authorization-request calls are
    // documented as safe from any thread, so `nonisolated(unsafe)` here — rather
    // than isolating this `Sendable` checker to `@MainActor` — is a targeted,
    // justified opt-out, not a blanket `@preconcurrency`/`@unchecked Sendable`.
    private nonisolated(unsafe) static let locationManager = CLLocationManager()

    public init(automationProbe: any AutomationProbing = SystemAutomationProbe()) {
        self.automationProbe = automationProbe
    }

    public func status(_ permission: Permission) async -> PermissionStatus {
        switch permission {
        case .accessibility:
            // Deliberately re-calls the OS primitive rather than delegating to
            // CoreMacOS's `SystemAccessibilityPermission`: this target is daemon-safe
            // and must not depend on CoreMacOS (which pulls in AppKit). `AXIsProcessTrusted`
            // is an OS-defined primitive, not knowledge we own, so the two thin
            // wrappers can't meaningfully diverge.
            return AXIsProcessTrusted() ? .granted : .denied
        case .notifications:
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            return Self.notificationStatus(settings.authorizationStatus)
        case .automation(let bundleID):
            let status = await automationStatus(forBundleID: bundleID, promptIfNeeded: false)
            return Self.automationStatus(status)
        case .location:
            return Self.locationStatus(Self.locationManager.authorizationStatus)
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
        case .location:
            // `requestAlwaysAuthorization` is the background-capable grant —
            // olylod observes location while the user is not in the app.
            Self.locationManager.requestAlwaysAuthorization()
            return await status(permission)
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

    /// Maps a `CLAuthorizationStatus` to a tri-state. Only `.authorizedAlways`
    /// counts as granted — a when-in-use grant is not enough for a daemon that
    /// observes location while the app is not running, so it must read as
    /// not-granted rather than as a lie.
    static func locationStatus(_ status: CLAuthorizationStatus) -> PermissionStatus {
        switch status {
        case .authorizedAlways: return .granted
        case .denied, .restricted: return .denied
        case .notDetermined: return .undetermined
        @unknown default: return .undetermined
        }
    }
}

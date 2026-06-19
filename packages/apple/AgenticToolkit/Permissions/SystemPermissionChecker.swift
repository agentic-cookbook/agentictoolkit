import ApplicationServices
import CoreServices
import Foundation
import UserNotifications

/// Production `PermissionChecking` over the real macOS permission APIs.
///
/// The Apple Events probe is injected so the granted-status mapping is testable;
/// the Accessibility and Notification checks are thin pass-throughs to the
/// system and are exercised only at runtime.
public struct SystemPermissionChecker: PermissionChecking {
    private let automationProbe: any AutomationProbing

    public init(automationProbe: any AutomationProbing = SystemAutomationProbe()) {
        self.automationProbe = automationProbe
    }

    public func isGranted(_ permission: Permission) async -> Bool {
        switch permission {
        case .accessibility:
            return AXIsProcessTrusted()
        case .notifications:
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            return settings.authorizationStatus == .authorized
        case .automation(let bundleID):
            let status = automationProbe.permissionStatus(forBundleID: bundleID, promptIfNeeded: false)
            return Self.isAutomationGranted(status)
        }
    }

    @discardableResult
    public func request(_ permission: Permission) async -> Bool {
        switch permission {
        case .accessibility:
            // String-literal key rather than the SDK's global `kAXTrustedCheckOptionPrompt`
            // var, which is not concurrency-safe to reference.
            let options = ["AXTrustedCheckOptionPrompt": true] as CFDictionary
            return AXIsProcessTrustedWithOptions(options)
        case .notifications:
            let granted = try? await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound])
            return granted ?? false
        case .automation(let bundleID):
            let status = automationProbe.permissionStatus(forBundleID: bundleID, promptIfNeeded: true)
            return Self.isAutomationGranted(status)
        }
    }

    /// Maps an `AEDeterminePermissionToAutomateTarget` status to a granted bool.
    /// `noErr` means permitted; every other status — denied (-1743),
    /// consent-required (-1744), target-not-running (-600), … — is treated as
    /// not granted.
    static func isAutomationGranted(_ status: OSStatus) -> Bool {
        status == noErr
    }
}

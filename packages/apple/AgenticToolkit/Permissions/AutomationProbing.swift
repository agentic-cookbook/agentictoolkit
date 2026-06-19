import Foundation

/// Abstraction over the Apple Events automation-permission probe.
///
/// Exists so the status→granted mapping in `SystemPermissionChecker` can be
/// unit-tested without real TCC state (which a test process cannot control).
public protocol AutomationProbing: Sendable {
    /// Mirrors `AEDeterminePermissionToAutomateTarget`: returns the `OSStatus`
    /// describing whether this process may send Apple Events to `bundleID`.
    /// `noErr` (0) means permitted; `errAEEventNotPermitted` (-1743) denied;
    /// `errAEEventWouldRequireUserConsent` (-1744) not yet decided.
    ///
    /// When `promptIfNeeded` is true and consent is undecided, the system shows
    /// the Automation consent dialog.
    func permissionStatus(forBundleID bundleID: String, promptIfNeeded: Bool) -> OSStatus
}

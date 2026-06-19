import CoreServices
import Foundation

/// Production `AutomationProbing` backed by `AEDeterminePermissionToAutomateTarget`.
///
/// Unlike sending a real Apple Event (or a generic "System Events" probe), this
/// API checks permission for a *specific* target app without launching it or
/// triggering side effects, and can optionally surface the consent dialog.
public struct SystemAutomationProbe: AutomationProbing {
    public init() {}

    public func permissionStatus(forBundleID bundleID: String, promptIfNeeded: Bool) -> OSStatus {
        var target = AEAddressDesc()
        let created = bundleID.withCString { ptr in
            OSStatus(AECreateDesc(typeApplicationBundleID, ptr, bundleID.utf8.count, &target))
        }
        guard created == noErr else { return created }
        defer { AEDisposeDesc(&target) }
        return AEDeterminePermissionToAutomateTarget(&target, typeWildCard, typeWildCard, promptIfNeeded)
    }
}

import AppKit
import AgenticToolkitPermissions

/// Drives the most useful grant flow for a permission from a user action, and
/// falls back to opening the relevant System Settings pane when an inline grant
/// isn't possible (e.g. notifications already denied, automation declined).
@MainActor
public enum PermissionPresenter {
    public static func present(_ permission: Permission, using checker: any PermissionChecking) async {
        switch permission {
        case .accessibility:
            // AXIsProcessTrustedWithOptions both prompts and opens the
            // Accessibility pane, so opening the URL too would be redundant.
            _ = await checker.request(permission)
        case .notifications, .automation:
            // Only fall back to System Settings on a hard denial. An undetermined
            // result (consent dialog cancelled/dismissed, or target app not running)
            // means the inline prompt already handled it — opening the pane on top
            // would be redundant, jarring UI.
            if await checker.request(permission) == .denied {
                NSWorkspace.shared.open(permission.settingsPaneURL)
            }
        }
    }
}

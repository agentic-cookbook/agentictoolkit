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
            let granted = await checker.request(permission)
            if !granted {
                NSWorkspace.shared.open(permission.settingsPaneURL)
            }
        }
    }
}

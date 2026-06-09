import Foundation

/// Errors that can occur when manipulating other apps' windows via AXUIElement.
public enum SystemWindowControlError: Error, CustomStringConvertible {
    /// No window was found matching the given CGWindowID.
    case windowNotFound(windowID: UInt32)

    /// The target app does not have an accessible AXUIElement reference.
    /// This typically means Accessibility permission has not been granted.
    case accessibilityNotAvailable(app: String, pid: Int32)

    /// The AXUIElement for the window was found, but the requested attribute
    /// could not be set (e.g., the window is not movable or not resizable).
    case attributeSetFailed(attribute: String, axError: Int32)

    /// The window's owning application could not be activated (focused).
    case activationFailed(app: String, pid: Int32)

    public var description: String {
        switch self {
        case .windowNotFound(let windowID):
            return "No window found with CGWindowID \(windowID)"
        case .accessibilityNotAvailable(let app, let pid):
            return "Accessibility not available for \(app) (PID \(pid)). "
                + "Grant Accessibility permission in System Settings."
        case .attributeSetFailed(let attribute, let axError):
            return "Failed to set \(attribute): AXError code \(axError)"
        case .activationFailed(let app, let pid):
            return "Failed to activate \(app) (PID \(pid))"
        }
    }
}

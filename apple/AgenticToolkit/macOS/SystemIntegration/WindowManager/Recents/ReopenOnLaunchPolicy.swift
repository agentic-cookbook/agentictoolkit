import Foundation

/// Whether the app should reopen previously-open windows at launch. Modeled
/// on Xcode's "Restore open projects and workspaces" preference.
public enum ReopenOnLaunchPolicy: String, Codable, Sendable, CaseIterable, Equatable {
    /// Follow macOS's system-wide "Close windows when quitting an
    /// application" preference (i.e. `NSQuitAlwaysKeepsWindows`).
    case useSystem
    /// Always reopen, regardless of the system setting.
    case always
    /// Never reopen, regardless of the system setting.
    case never

    public var displayName: String {
        switch self {
        case .useSystem: return "Use System Setting"
        case .always: return "Always"
        case .never: return "Never"
        }
    }

    public func shouldReopen(systemDefault: Bool) -> Bool {
        switch self {
        case .useSystem: return systemDefault
        case .always: return true
        case .never: return false
        }
    }

    /// macOS-wide preference: when ON, the system preserves windows across
    /// quit/relaunch cycles. The System Settings UI inverts the label
    /// ("Close windows when quitting an application" — checking it sets
    /// `NSQuitAlwaysKeepsWindows = false`).
    public static var systemDefault: Bool {
        UserDefaults.standard.bool(forKey: "NSQuitAlwaysKeepsWindows")
    }
}

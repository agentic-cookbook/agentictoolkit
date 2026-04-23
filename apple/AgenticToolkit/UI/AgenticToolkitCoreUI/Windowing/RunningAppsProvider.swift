import AppKit

/// Narrow abstraction over `NSWorkspace` / `NSRunningApplication` so activation
/// strategies can be exercised in tests without a real running app list.
///
/// The default implementation (`RealRunningAppsProvider`) delegates to
/// `NSWorkspace.shared` and `NSRunningApplication`; tests inject their own.
public protocol RunningAppsProvider: Sendable {
    /// All apps currently running, in no particular order.
    var runningApplications: [NSRunningApplication] { get }

    /// Running apps whose bundle identifier matches — typically zero or one entry.
    func runningApplications(withBundleIdentifier bundleID: String) -> [NSRunningApplication]

    /// The frontmost (key) application, or nil if headless.
    var frontmostApplication: NSRunningApplication? { get }
}

/// Default implementation that hits `NSWorkspace` / `NSRunningApplication`.
public struct RealRunningAppsProvider: RunningAppsProvider {
    public init() {}

    public var runningApplications: [NSRunningApplication] {
        NSWorkspace.shared.runningApplications
    }

    public func runningApplications(withBundleIdentifier bundleID: String) -> [NSRunningApplication] {
        NSRunningApplication.runningApplications(withBundleIdentifier: bundleID)
    }

    public var frontmostApplication: NSRunningApplication? {
        NSWorkspace.shared.frontmostApplication
    }
}

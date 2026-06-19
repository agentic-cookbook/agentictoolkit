import Foundation

/// Reads and requests the grant state of macOS privacy permissions.
///
/// Async so implementations can await the system's notification APIs without
/// the semaphore-blocking hacks the old code used.
public protocol PermissionChecking: Sendable {
    /// Whether `permission` is currently granted. Side-effect free and safe to
    /// poll — it never shows a system prompt.
    func isGranted(_ permission: Permission) async -> Bool

    /// Surfaces the system request flow for `permission` (the AX prompt, the
    /// notification authorization request, or the Automation consent dialog) and
    /// returns the resulting grant state.
    @discardableResult
    func request(_ permission: Permission) async -> Bool
}

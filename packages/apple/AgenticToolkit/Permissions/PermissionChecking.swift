import Foundation

/// Reads and requests the grant state of macOS privacy permissions.
///
/// Async so implementations can await the system's notification APIs and run the
/// (blocking) Apple Events probe off the cooperative thread pool without the
/// semaphore-blocking hacks the old code used.
public protocol PermissionChecking: Sendable {
    /// The current tri-state status of `permission`. Side-effect free and safe to
    /// poll — it never shows a system prompt.
    func status(_ permission: Permission) async -> PermissionStatus

    /// Surfaces the system request flow for `permission` (the AX prompt, the
    /// notification authorization request, or the Automation consent dialog) and
    /// returns the resulting status.
    @discardableResult
    func request(_ permission: Permission) async -> PermissionStatus
}

extension PermissionChecking {
    /// Convenience: whether `permission` is currently `.granted`.
    public func isGranted(_ permission: Permission) async -> Bool {
        await status(permission) == .granted
    }
}

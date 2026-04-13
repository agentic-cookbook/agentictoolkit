import AppKit

/// Conform to this protocol and implement `windowManagerID` and `managedWindow`
/// to get frame save/restore helpers via WindowManager.
///
/// Usage in NSWindowDelegate:
/// ```swift
/// func windowDidMove(_ notification: Notification) { saveManagedFrame() }
/// func windowDidResize(_ notification: Notification) { saveManagedFrame() }
/// ```
@MainActor
public protocol ManagedWindow: NSWindowDelegate {
    var windowManagerID: String { get }
    var managedWindow: NSWindow? { get }
}

extension ManagedWindow {
    public func saveManagedFrame() {
        guard let window = managedWindow else { return }
        WindowManager.shared.saveFrame(for: window, id: windowManagerID)
    }

    public func restoreManagedFrame() {
        guard let window = managedWindow else { return }
        WindowManager.shared.restoreFrame(for: window, id: windowManagerID)
    }
}

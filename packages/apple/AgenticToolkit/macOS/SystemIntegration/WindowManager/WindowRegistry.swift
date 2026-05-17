import AppKit

/// Tracks every live `SingleWindowController` by its `windowID` so callers
/// (scripting commands, debug tools) can look one up without holding a
/// reference. Entries hold weak refs — a dropped controller naturally
/// disappears from `controller(forID:)` lookups.
///
/// Owned by `WindowManager`; populated automatically by
/// `SingleWindowController.init(windowID:contentViewController:)`.
@MainActor
public final class WindowRegistry {

    private struct WeakBox {
        weak var controller: SingleWindowController?
    }

    private var entries: [String: WeakBox] = [:]

    public init() {}

    /// Registers the controller under its own `windowID`. Re-registering the
    /// same `windowID` replaces the prior entry — the assumption is one live
    /// controller per ID.
    public func register(_ controller: SingleWindowController) {
        guard !controller.windowID.isEmpty else { return }
        entries[controller.windowID] = WeakBox(controller: controller)
    }

    /// Returns the live controller for `id`, or `nil` if none is registered
    /// or the previously-registered one has been deallocated.
    public func controller(forID id: String) -> SingleWindowController? {
        entries[id]?.controller
    }

    /// IDs of every currently-live registered controller. Useful for
    /// debugging and scripting introspection.
    public var registeredIDs: [String] {
        entries.compactMap { $0.value.controller != nil ? $0.key : nil }
    }
}

import AppKit

/// Surface that toolkit-side `NSScriptCommand` subclasses use to find the
/// host's feature coordinators without depending on the host app's
/// `AppDelegate` type.
///
/// The host implements this once (typically by forwarding to its
/// `ScriptingRouter`); each toolkit command resolves the feature it needs
/// via `feature(_:)`, e.g.
///
/// ```swift
/// let host = NSApp.delegate as? ScriptingHost
/// let watcher = host?.feature(SessionWatcherCoordinator.self)
/// ```
@MainActor
public protocol ScriptingHost: AnyObject {
    /// Returns the registered feature of the requested type, or `nil` if no
    /// feature of that type was registered.
    func feature<F: AnyObject>(_ type: F.Type) -> F?
}

extension NSApplication {
    /// Convenience: resolves the running app's delegate as a `ScriptingHost`.
    /// `nil` if the host hasn't adopted the protocol.
    @MainActor
    public var scriptingHost: ScriptingHost? {
        delegate as? ScriptingHost
    }
}

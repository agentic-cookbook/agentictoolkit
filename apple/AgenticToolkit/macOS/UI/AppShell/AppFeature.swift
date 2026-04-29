import Foundation

/// A self-contained feature module the host app composes during launch.
/// Hosts collect their `AppFeature`s into an array and call the lifecycle
/// hooks at the appropriate `NSApplicationDelegate` events.
///
/// All hooks are optional — features only implement what they need.
@MainActor
public protocol AppFeature: AnyObject {
    /// Called once per launch, after the feature has been constructed and
    /// other features in the same launch wave are visible. Bring up
    /// long-running services here (timers, file watchers, ingestion, …).
    func start() throws

    /// Called from `applicationWillTerminate(_:)`. Stop synchronous services
    /// here. Pair with `terminate()` for async cleanup.
    func stop()

    /// Called from `applicationWillTerminate(_:)`, after `stop()`. Use for
    /// async shutdown work like flushing pending saves.
    func terminate() async
}

extension AppFeature {
    public func start() throws {}
    public func stop() {}
    public func terminate() async {}
}

import Foundation

/// A streaming log source: owns the underlying ``LogProvider`` plus the
/// connection, pause, and error state that a toolbar needs to expose.
///
/// ``LogViewController`` reads these properties to drive its status dot,
/// pause button, and lifecycle — it never talks to the provider directly
/// for state changes, only for data. Concrete controllers (HTTP/SSE,
/// file tail, test stubs) implement the surface to suit their transport.
@MainActor
public protocol LogController: AnyObject {
    /// Backing store displayed by ``LogView``.
    var provider: any LogProvider { get }

    /// True while the source's transport is live. Drives the "connected"
    /// status dot.
    var isConnected: Bool { get }

    /// True while the source is dropping inbound rows on the floor
    /// (typically because the user hit Pause). Drives the pause button
    /// title.
    var isPaused: Bool { get }

    /// Last transport-level error as a user-visible string, or `nil` if
    /// the source is healthy.
    var lastError: String? { get }

    /// Fires on connection / pause / error transitions so the view can
    /// refresh its indicators without subscribing to the provider.
    var onStateChange: (@MainActor () -> Void)? { get set }

    /// Open the transport and begin delivering rows. Safe to call
    /// repeatedly — implementations are expected to tear down any
    /// previous stream first.
    func start()

    /// Close the transport and stop delivering rows. Does not clear the
    /// provider.
    func stop()

    /// Flip the pause flag. Rows that arrive while paused are dropped;
    /// the buffer keeps the rows it already had.
    func togglePause()

    /// Empty the provider.
    func clear()
}

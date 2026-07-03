import Foundation

/// A resource that the bounded queue executes work against and can abort while a
/// unit of work is still mid-flight.
///
/// One resource is driven by exactly one lane worker (a serial queue), so a
/// conformance's work body is never re-entered concurrently — but `interrupt()`
/// MUST be safe to call from another thread (the watchdog).
///
/// There are two independent abort channels, both driven by the queue's per-op
/// deadline. A resource should wire up whichever it can; wiring both gives
/// defense-in-depth:
///
/// - **`installAbortHook`** — a hook the resource consults *while it is working*
///   (e.g. SQLite's `sqlite3_progress_handler`, every N virtual-machine
///   instructions). Returning `true` must abort the current unit. This is the
///   only channel that still fires while the CPU is fully saturated, because it
///   needs no other thread to run. Optional: a resource that cannot poll
///   mid-work leaves the default no-op and relies on `interrupt()` alone.
///
/// - **`interrupt()`** — called from the watchdog thread when a unit blows its
///   deadline (e.g. SQLite's `sqlite3_interrupt`). This covers a unit stuck in a
///   single long syscall (`read`/`fsync`) that never reaches the hook. It must
///   be idempotent and a no-op when the resource is idle.
///
/// Neither channel can preempt genuinely uncooperative work (a tight pure-Swift
/// loop that consults nothing): the guarantee is "if your resource honours these
/// hooks, the queue will eject it." SQLite honours both.
public protocol BoundedExecutionResource: AnyObject, Sendable {
    /// Install a hook the resource polls while executing; returning `true` aborts
    /// the in-flight unit as soon as possible. Called once, when the queue binds
    /// this resource to a lane worker.
    func installAbortHook(_ shouldAbort: @escaping @Sendable () -> Bool)

    /// Abort whatever unit is currently running on this resource, from another
    /// thread. Idempotent; a no-op when the resource is idle.
    func interrupt()

    /// Release any underlying handle. The queue's `shutdown()` calls this so a
    /// resource's connection/socket/process is torn down *deterministically* rather
    /// than whenever ARC releases the queue (whose watchdog timer can keep the
    /// resources alive briefly). Must be idempotent; default no-op.
    func close()
}

public extension BoundedExecutionResource {
    /// Default: a resource that can't self-poll relies solely on `interrupt()`.
    func installAbortHook(_ shouldAbort: @escaping @Sendable () -> Bool) {}
    /// Default: nothing to release.
    func close() {}
}

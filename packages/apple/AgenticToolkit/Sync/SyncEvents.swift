import Foundation

/// Why the sync engine woke up to run a cycle.
public enum SyncKickReason: Sendable, Equatable {
    case periodic
    case connectivityRestored
    case manual
    case hostSpecific(String)
}

/// Observable lifecycle events emitted by the sync engine (Task 4) as it
/// runs a cycle. Hosts subscribe to drive UI (status pills, badges, etc.).
public enum SyncEvent: Sendable, Equatable {
    case started(SyncKickReason)
    case pulledBatch(changes: Int, cursor: SyncCursor)
    case pushed(applied: Int, conflicts: Int, rejected: Int)
    case conflictResolved(resource: String, rowId: String)
    case resyncPerformed
    case authRequired
    case failed(String)     // human-readable; ops remain queued
    case idle
}

public extension SyncEvent {
    /// Proof the engine reached the backend this cycle — NOT proof the cycle
    /// was healthy. This is a **reachability** signal, not a sync-health one,
    /// and that distinction is deliberate: `.authRequired` counts, because
    /// the backend answered — it just rejected our credential. `.pulledBatch`
    /// (fires on every successful pull round trip, even an empty one) and
    /// `.idle` (a full pull+push cycle completed with no error) count for
    /// the same reason: they're proof of a live round trip. `.failed` is
    /// excluded — it covers both "never reached the backend" and "the
    /// backend errored," neither of which is proof of reachability.
    /// Exhaustive over `SyncEvent`'s cases on purpose: a new case added here
    /// should force a decision at this call site, not silently fall through
    /// a `default:`.
    var reachedBackend: Bool {
        switch self {
        case .pulledBatch, .idle, .authRequired:
            return true
        case .started, .pushed, .conflictResolved, .resyncPerformed, .failed:
            return false
        }
    }
}

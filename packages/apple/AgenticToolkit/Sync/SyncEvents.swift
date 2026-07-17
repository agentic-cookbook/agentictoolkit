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

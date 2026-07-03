import Foundation

/// Identifies a pool of interchangeable resources — a "lane". Work submitted to a
/// pool runs on one of that pool's resources; a pool with a single resource fully
/// serialises its work, a pool with several runs that many units concurrently
/// (the bulkhead: e.g. a one-resource write lane and a several-resource read lane
/// that never queues behind the writer).
public struct PoolID: Hashable, Sendable, CustomStringConvertible {
    public let name: String
    public init(_ name: String) { self.name = name }
    public var description: String { name }
}

/// The result of running one maintenance chunk: `.more` when there is further
/// work to do, `.done` once the backlog for this pass is drained.
public enum ChunkOutcome: Sendable, Equatable {
    case more
    case done
}

/// Errors surfaced by ``BoundedExecutionQueue``.
public enum ExecutionError: Error, Sendable, Equatable {
    /// The unit ran past its deadline and was ejected (via the abort hook and/or
    /// `interrupt()`). Whatever the body itself threw is discarded in favour of
    /// this, so callers can treat an eviction uniformly.
    case deadlineExceeded(pool: String, elapsed: Duration)
    /// `run`/`runChunked` named a pool the queue was not configured with.
    case poolNotFound(String)
    /// The queue has been shut down and rejects new work.
    case shuttingDown
}

/// A point-in-time snapshot of one pool's counters, for `/db/stats` and health.
public struct PoolStats: Sendable, Equatable {
    public let pool: String
    /// Units currently executing on this pool's resources.
    public let inFlight: Int
    /// Units that completed within budget since start.
    public let completed: Int
    /// Units ejected for exceeding their deadline since start.
    public let evicted: Int
    /// Median / 99th-percentile duration over a bounded window of recent units.
    public let p50: Duration
    public let p99: Duration

    public init(
        pool: String, inFlight: Int, completed: Int, evicted: Int,
        p50: Duration, p99: Duration
    ) {
        self.pool = pool
        self.inFlight = inFlight
        self.completed = completed
        self.evicted = evicted
        self.p50 = p50
        self.p99 = p99
    }
}

/// All pools' stats in one snapshot.
public struct ExecutionStats: Sendable, Equatable {
    public let pools: [PoolStats]
    public init(pools: [PoolStats]) { self.pools = pools }
}

extension Duration {
    /// Seconds as a `Double`, for wall-clock arithmetic against `Date`.
    var seconds: Double {
        let (secs, atto) = components
        return Double(secs) + Double(atto) / 1e18
    }
}

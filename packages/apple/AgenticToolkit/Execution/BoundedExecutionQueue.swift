import Foundation

/// How many recent per-unit durations each worker keeps for percentile stats.
private let statsWindowSize = 128

/// A bounded execution queue: it runs work against pools of ``BoundedExecutionResource``
/// and guarantees every unit is either fast or ejected. It knows nothing about
/// what a resource *is* (SQLite connection, subprocess, socket) — only that it
/// can be timed and interrupted. That is the whole point: policy (deadlines,
/// bulkhead, watchdog, chunking, metrics) lives here once; the resource-specific
/// abort mechanism lives behind the protocol.
///
/// ## Guarantees
/// - **Bulkhead.** Work runs on the pool it names; a pool with N resources runs N
///   units concurrently, so reads on a multi-resource read pool never queue behind
///   a heavy write on a single-resource write pool.
/// - **Ejection.** Every unit carries a deadline. Two independent channels enforce
///   it: the resource's self-poll hook (fires even under full CPU) and a watchdog
///   thread that calls `interrupt()` (fires even when the unit is blocked in a
///   syscall). An ejected unit throws ``ExecutionError/deadlineExceeded(pool:elapsed:)``.
/// - **Chunking.** Maintenance work is expressed only as bounded, yielding chunks
///   (``runChunked(pool:chunkDeadline:tickBudget:maxChunks:_:)``) so a backlog can
///   never be drained in one queue-hogging pass.
///
/// `runSync` deliberately *blocks* the caller (like `DispatchQueue.sync`) rather
/// than being `async`. Because every unit is deadline-bounded, blocking is
/// bounded too — and it keeps the door open for synchronous callers without
/// forcing an `async` ripple through them. Reads belong on a concurrent read
/// pool so a blocked caller never starves other readers.
public final class BoundedExecutionQueue<Resource: BoundedExecutionResource>: @unchecked Sendable {

    // MARK: - Worker

    /// One resource plus the serial queue that drives it and the live-op box the
    /// abort hook + watchdog read. `@unchecked Sendable`: all mutable state is
    /// guarded by `lock`.
    private final class Worker: @unchecked Sendable {
        let resource: Resource
        let queue: DispatchQueue

        private let lock = NSLock()
        private var deadlineDate: Date?      // non-nil only while a unit is running
        private var aborted = false
        private var interruptSent = false
        private(set) var inFlight = 0
        private(set) var completed = 0
        private(set) var evicted = 0
        private var recent: [Double] = []    // recent durations (s), bounded window

        init(resource: Resource, label: String) {
            self.resource = resource
            self.queue = DispatchQueue(label: label, qos: .userInitiated)
        }

        func begin(deadline: Duration) {
            lock.withLock {
                deadlineDate = Date().addingTimeInterval(deadline.seconds)
                aborted = false
                interruptSent = false
                inFlight += 1
            }
        }

        /// Ends the unit: clears the deadline, records duration/stats, and returns
        /// whether it was ejected.
        func end(start: Date) -> Bool {
            lock.withLock {
                let wasAborted = aborted
                deadlineDate = nil
                inFlight -= 1
                if wasAborted {
                    evicted += 1
                } else {
                    completed += 1
                    recent.append(Date().timeIntervalSince(start))
                    if recent.count > statsWindowSize { recent.removeFirst(recent.count - statsWindowSize) }
                }
                return wasAborted
            }
        }

        /// Consulted by the resource's self-poll hook while it works.
        func shouldAbortNow() -> Bool {
            lock.withLock {
                guard let deadlineDate else { return false }
                if Date() >= deadlineDate { aborted = true; return true }
                return false
            }
        }

        /// Called by the watchdog. Returns true exactly once per over-budget unit —
        /// the caller then invokes `resource.interrupt()` outside the lock.
        func claimInterruptIfOverdue() -> Bool {
            lock.withLock {
                guard let deadlineDate, !interruptSent, Date() >= deadlineDate else { return false }
                aborted = true
                interruptSent = true
                return true
            }
        }

        func snapshot() -> (inFlight: Int, completed: Int, evicted: Int, recent: [Double]) {
            lock.withLock { (inFlight, completed, evicted, recent) }
        }
    }

    // MARK: - State

    private let pools: [PoolID: [Worker]]
    private let cursorLock = NSLock()
    private var cursors: [PoolID: Int] = [:]
    private let stateLock = NSLock()
    private var shuttingDown = false
    private let watchdog: DispatchSourceTimer
    /// Set on every worker's queue to its pool name, so `isExecuting(on:)` can tell
    /// whether the current thread is already inside a unit of a given pool — the
    /// reentrancy guard a caller needs to avoid deadlocking on its own lane.
    private let poolKey = DispatchSpecificKey<String>()

    // MARK: - Init

    /// - Parameters:
    ///   - pools: resources grouped into named lanes. Each pool needs ≥1 resource.
    ///   - watchdogInterval: how often the watchdog scans for over-budget units.
    ///     Smaller = tighter ejection latency for syscall-blocked units, at a
    ///     little more idle CPU. 50 ms is a good default.
    public init(pools: [PoolID: [Resource]], watchdogInterval: Duration = .milliseconds(50)) {
        var built: [PoolID: [Worker]] = [:]
        for (id, resources) in pools {
            precondition(!resources.isEmpty, "pool \(id) must have at least one resource")
            let workers = resources.enumerated().map { index, resource in
                Worker(resource: resource, label: "com.agentic.execution.\(id.name).\(index)")
            }
            for worker in workers { worker.queue.setSpecific(key: poolKey, value: id.name) }
            built[id] = workers
        }
        self.pools = built

        // Install each resource's self-poll hook, bound to its worker's live-op box.
        for workers in built.values {
            for worker in workers {
                worker.resource.installAbortHook { [weak worker] in worker?.shouldAbortNow() ?? false }
            }
        }

        // Start the watchdog: interrupt any unit past its deadline.
        let timerQueue = DispatchQueue(label: "com.agentic.execution.watchdog", qos: .userInitiated)
        self.watchdog = DispatchSource.makeTimerSource(queue: timerQueue)
        let allWorkers = built.values.flatMap { $0 }
        watchdog.schedule(deadline: .now() + watchdogInterval.seconds, repeating: watchdogInterval.seconds)
        watchdog.setEventHandler {
            for worker in allWorkers where worker.claimInterruptIfOverdue() {
                worker.resource.interrupt()
            }
        }
        watchdog.resume()
    }

    // MARK: - Run

    /// Runs `body` on one resource of `pool`, ejecting it if it exceeds `deadline`.
    /// Blocks the caller until the unit completes or is ejected.
    public func runSync<T>(
        pool: PoolID,
        deadline: Duration,
        _ body: (Resource) throws -> T
    ) throws -> T {
        if isShuttingDown { throw ExecutionError.shuttingDown }
        guard let worker = pickWorker(pool) else { throw ExecutionError.poolNotFound(pool.name) }
        return try worker.queue.sync {
            worker.begin(deadline: deadline)
            let start = Date()
            let value: T?
            let thrown: Error?
            do {
                value = try body(worker.resource); thrown = nil
            } catch {
                value = nil; thrown = error
            }
            let ejected = worker.end(start: start)
            if ejected {
                throw ExecutionError.deadlineExceeded(
                    pool: pool.name,
                    elapsed: .seconds(Date().timeIntervalSince(start))
                )
            }
            if let thrown { throw thrown }
            return value!
        }
    }

    /// Drains a maintenance backlog as bounded, yielding chunks. Each chunk is its
    /// own deadline-enforced unit submitted separately, so other work on the pool
    /// (e.g. live ingest on the write lane) interleaves *between* chunks. Stops at
    /// the first `.done`, when `tickBudget` elapses, or after `maxChunks`. Returns
    /// the number of chunks run.
    @discardableResult
    public func runChunked(
        pool: PoolID,
        chunkDeadline: Duration,
        tickBudget: Duration,
        maxChunks: Int,
        _ body: @escaping (Resource) throws -> ChunkOutcome
    ) throws -> Int {
        let start = Date()
        var chunks = 0
        while chunks < maxChunks {
            let outcome = try runSync(pool: pool, deadline: chunkDeadline) { try body($0) }
            chunks += 1
            if outcome == .done { break }
            if Date().timeIntervalSince(start) >= tickBudget.seconds { break }
        }
        return chunks
    }

    // MARK: - Introspection

    /// Whether the current thread is already executing a unit on `pool`. Lets a
    /// caller run nested work inline on the same connection instead of submitting
    /// again (which would deadlock on that pool's serial lane) — e.g. a read issued
    /// from inside a write transaction, which must use the write connection to see
    /// its own uncommitted rows.
    public func isExecuting(on pool: PoolID) -> Bool {
        DispatchQueue.getSpecific(key: poolKey) == pool.name
    }

    public var stats: ExecutionStats {
        let poolStats = pools.map { id, workers -> PoolStats in
            var inFlight = 0, completed = 0, evicted = 0
            var durations: [Double] = []
            for worker in workers {
                let snap = worker.snapshot()
                inFlight += snap.inFlight
                completed += snap.completed
                evicted += snap.evicted
                durations.append(contentsOf: snap.recent)
            }
            durations.sort()
            return PoolStats(
                pool: id.name, inFlight: inFlight, completed: completed, evicted: evicted,
                p50: Self.percentile(durations, 0.50), p99: Self.percentile(durations, 0.99)
            )
        }
        return ExecutionStats(pools: poolStats.sorted { $0.pool < $1.pool })
    }

    /// Stops the watchdog, closes every resource, and rejects further work.
    /// Idempotent. Closing here (rather than leaving it to ARC) makes teardown
    /// deterministic — important when a consumer creates and destroys many queues
    /// on the same underlying file and must not leave connections holding locks.
    public func shutdown() {
        let alreadyDown: Bool = stateLock.withLock {
            if shuttingDown { return true }
            shuttingDown = true
            watchdog.cancel()
            return false
        }
        guard !alreadyDown else { return }
        for workers in pools.values {
            for worker in workers { worker.resource.close() }
        }
    }

    // MARK: - Private

    private var isShuttingDown: Bool { stateLock.withLock { shuttingDown } }

    /// Round-robin a pool's workers so multi-resource pools spread load.
    private func pickWorker(_ pool: PoolID) -> Worker? {
        guard let workers = pools[pool], !workers.isEmpty else { return nil }
        if workers.count == 1 { return workers[0] }
        let index: Int = cursorLock.withLock {
            let next = (cursors[pool] ?? 0) % workers.count
            cursors[pool] = next + 1
            return next
        }
        return workers[index]
    }

    private static func percentile(_ sorted: [Double], _ quantile: Double) -> Duration {
        guard !sorted.isEmpty else { return .zero }
        let rank = Int((Double(sorted.count - 1) * quantile).rounded())
        return .seconds(sorted[min(max(rank, 0), sorted.count - 1)])
    }
}

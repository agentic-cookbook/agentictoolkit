import Foundation
import os

/// A guard refusal — terminal for this attempt. Deliberately NOT a
/// `DaemonAIChat.ChatError`: callers that degrade on transport errors still do,
/// but nothing may reinterpret a refusal as "try another transport" — in
/// particular it must never cascade into the `claude -p` fallback.
public enum AIGuardError: Error, LocalizedError, Equatable {
    case blocked(String)
    case deferred(String)

    public var errorDescription: String? {
        switch self {
        case .blocked(let reason), .deferred(let reason):
            return reason
        }
    }
}

/// The inference-time memory guard: verdicts local-model requests against the
/// machine's RAM budget and live pressure, and serializes local inference
/// process-wide so two host features (e.g. summaries and oversight) can't trigger
/// two model loads at once.
public actor LocalInferenceGuard {
    public static let shared = LocalInferenceGuard()

    private static let logger = Logger(
        subsystem: "com.agentic-cookbook.AIPluginKit", category: "LocalInferenceGuard")

    /// Default wall-clock bound on one exclusive operation: a hung local server
    /// must not hold the process-wide inference lock forever.
    public static let defaultDeadline: TimeInterval = 600

    private let catalog: LocalModelCatalog
    private let memory: any SystemMemoryMonitoring
    private var busy = false
    /// Parked acquirers, FIFO. Resumed with `true` when ownership is handed off,
    /// `false` when the waiter was cancelled while parked (it then throws).
    private var waiters: [(id: UUID, continuation: CheckedContinuation<Bool, Never>)] = []

    /// Test seam: how many acquirers are currently parked on the lock.
    var waiterCount: Int { waiters.count }

    public init(
        catalog: LocalModelCatalog = .shared,
        memory: any SystemMemoryMonitoring = SystemMemoryMonitor.shared
    ) {
        self.catalog = catalog
        self.memory = memory
    }

    /// The decision for one request to a loopback provider. Thresholds come from
    /// the host's settings reader (warn/block % of RAM), defaulted by the policy.
    public func verdict(
        model: String, baseURL: String, settings: ProviderSettingsReader
    ) async -> ModelFitPolicy.Verdict {
        let warnPct = settings(ModelFitPolicy.warnPctKey).flatMap(Int.init)
            ?? ModelFitPolicy.defaultWarnPct
        let blockPct = settings(ModelFitPolicy.blockPctKey).flatMap(Int.init)
            ?? ModelFitPolicy.defaultBlockPct
        let diskBytes = await catalog.sizeBytes(model: model, baseURL: baseURL)
        // Warn tier proceeds, but its footprint is surfaced in the log so a
        // large-but-allowed model never runs invisibly.
        if let diskBytes,
           ModelFitPolicy.tier(diskBytes: diskBytes, physicalRAM: memory.physicalRAM,
                               warnPct: warnPct, blockPct: blockPct) == .warn {
            let est = ModelFitPolicy.estimatedBytes(diskBytes: diskBytes)
            let message = "Local model \(model) is warn-tier: ~\(ModelFitPolicy.gbString(est)) est. "
                + "(\(ModelFitPolicy.ramPct(est, of: memory.physicalRAM))% of RAM)"
            Self.logger.notice("\(message, privacy: .public)")
        }
        return ModelFitPolicy.verdict(
            model: model, diskBytes: diskBytes, physicalRAM: memory.physicalRAM,
            warnPct: warnPct, blockPct: blockPct, pressure: memory.pressureLevel
        )
    }

    /// The live-pressure component of the verdict alone — for re-checking inside the
    /// critical section: the wait for the lock can outlive the pre-park `verdict`,
    /// and pressure that arose meanwhile must still defer.
    public func pressureVerdict() -> ModelFitPolicy.Verdict {
        ModelFitPolicy.pressureVerdict(memory.pressureLevel)
    }

    /// Runs `operation` with local inference serialized process-wide. Actor methods
    /// are reentrant across `await`, so exclusivity needs a real async mutex:
    /// acquirers park in FIFO order and ownership is handed off directly — a
    /// finishing operation resumes the head waiter as the new owner, with `busy`
    /// staying true across the handoff (it falls only when no waiters remain), so
    /// a late arrival can never barge ahead of the queue.
    ///
    /// A parked waiter that is cancelled leaves the queue and throws
    /// `CancellationError` without running `operation`. `deadline` bounds the
    /// operation's wall-clock run: on expiry the operation's task is cancelled,
    /// `AIGuardError.deferred` is thrown, and the lock is handed off as usual.
    public func runExclusive<T: Sendable>(
        deadline: TimeInterval = defaultDeadline,
        _ operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await acquire()
        defer { release() }
        try Task.checkCancellation()
        return try await Self.withDeadline(deadline, run: operation)
    }

    // MARK: - Async mutex

    private func acquire() async throws {
        if !busy {
            busy = true
            return
        }
        let id = UUID()
        let granted = await withTaskCancellationHandler {
            await withCheckedContinuation { continuation in
                waiters.append((id: id, continuation: continuation))
            }
        } onCancel: {
            Task { await self.cancelWaiter(id) }
        }
        guard granted else { throw CancellationError() }
    }

    private func cancelWaiter(_ id: UUID) {
        // Still parked (a handoff would have removed it): leave the queue and
        // unpark so `acquire` can throw. If the handoff won the race, the waiter
        // already owns the lock and `runExclusive`'s cancellation check releases it.
        guard let index = waiters.firstIndex(where: { $0.id == id }) else { return }
        waiters.remove(at: index).continuation.resume(returning: false)
    }

    private func release() {
        if waiters.isEmpty {
            busy = false
        } else {
            // Direct handoff: the head waiter becomes the owner; `busy` never dips
            // to false in between, so no arrival can slip past the queue.
            waiters.removeFirst().continuation.resume(returning: true)
        }
    }

    /// Races `operation` against a wall-clock timer; on expiry cancels it and
    /// throws `AIGuardError.deferred` so hosts record the refusal like any other.
    private static func withDeadline<T: Sendable>(
        _ deadline: TimeInterval, run operation: @escaping @Sendable () async throws -> T
    ) async throws -> T {
        try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask { try await operation() }
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(max(0, deadline) * 1_000_000_000))
                throw AIGuardError.deferred(
                    "local inference exceeded its \(Int(deadline))s deadline; deferring")
            }
            defer { group.cancelAll() }
            // The first finisher wins: the operation's value/error, or the timer's
            // deferral. The loser is cancelled and its outcome discarded.
            guard let result = try await group.next() else {
                throw CancellationError()  // unreachable: the group has two children
            }
            return result
        }
    }
}

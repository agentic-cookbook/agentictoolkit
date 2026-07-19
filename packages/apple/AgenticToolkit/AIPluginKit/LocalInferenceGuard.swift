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

    private let catalog: LocalModelCatalog
    private let memory: any SystemMemoryMonitoring
    private var busy = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

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

    /// Runs `op` with local inference serialized process-wide. Actor methods are
    /// reentrant across `await`, so exclusivity needs a real async mutex: waiters
    /// park in FIFO continuations until the current op finishes.
    public func runExclusive<T: Sendable>(
        _ operation: @Sendable () async throws -> T
    ) async rethrows -> T {
        while busy {
            await withCheckedContinuation { waiters.append($0) }
        }
        busy = true
        defer {
            busy = false
            if !waiters.isEmpty { waiters.removeFirst().resume() }
        }
        return try await operation()
    }
}

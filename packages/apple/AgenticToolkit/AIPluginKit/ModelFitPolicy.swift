import Foundation

/// System memory-pressure level as the guard consumes it — a latched snapshot of the
/// OS's DispatchSource memory-pressure events (`normal` until an event says otherwise).
public enum MemoryPressureLevel: String, Sendable, Equatable {
    case normal, warning, critical
}

/// The local-model memory-budget policy — a pure function from (model size, machine
/// RAM, thresholds, pressure) to a tier/verdict. Toolkit-level so every AIPluginKit
/// host shares one representation: `DaemonAIChat` enforces with it, app pickers
/// label with it, and the two cannot drift.
public enum ModelFitPolicy {

    /// Resident footprint always exceeds on-disk size (KV cache, context buffers);
    /// disk × this multiplier is the floor estimate the tiers are computed from.
    public static let residentOverheadMultiplier = 1.2

    /// Threshold defaults, as % of physical RAM. The guard reads stored overrides
    /// under the two keys via the host's `ProviderSettingsReader`; pickers use the
    /// defaults directly.
    public static let defaultWarnPct = 25
    public static let defaultBlockPct = 50
    public static let warnPctKey = "ai_guard_warn_pct"
    public static let blockPctKey = "ai_guard_block_pct"

    public enum Tier: Equatable, Sendable {
        // swiftlint:disable:next identifier_name
        case ok, warn, block
    }

    public enum Verdict: Equatable, Sendable {
        case allow
        case block(reason: String)
        case deferred(reason: String)
    }

    /// The structured "how does this model fit" answer: the human text (sans model
    /// name) plus the tier that produced it, so render sites style by tier without
    /// re-deriving it (or reverse-parsing `pickerLabel`).
    public struct FitInfo: Equatable, Sendable {
        public let text: String
        public let tier: Tier

        public init(text: String, tier: Tier) {
            self.text = text
            self.tier = tier
        }
    }

    /// Estimated resident bytes for a model of `diskBytes` on disk.
    public static func estimatedBytes(diskBytes: Int) -> Int {
        Int(Double(diskBytes) * residentOverheadMultiplier)
    }

    /// The tier a model of known size falls in; nil when the size is unknown
    /// (non-ollama local servers — callers fail open).
    public static func tier(
        diskBytes: Int?, physicalRAM: UInt64,
        warnPct: Int = defaultWarnPct, blockPct: Int = defaultBlockPct
    ) -> Tier? {
        guard let diskBytes, physicalRAM > 0 else { return nil }
        let pct = Double(estimatedBytes(diskBytes: diskBytes)) / Double(physicalRAM) * 100
        if pct >= Double(blockPct) { return .block }
        if pct >= Double(warnPct) { return .warn }
        return .ok
    }

    /// The pressure-only component of `verdict`, exposed on its own so the guard can
    /// re-check it inside the critical section — the wait for the inference lock can
    /// outlive a pre-park verdict.
    public static func pressureVerdict(_ pressure: MemoryPressureLevel) -> Verdict {
        guard pressure != .normal else { return .allow }
        return .deferred(reason: "memory pressure is \(pressure.rawValue); deferring local inference")
    }

    /// The inference-time decision. Pressure comes first: under warning/critical even
    /// a small (or unknown-size) model is deferred — the machine is already short.
    /// Then the size tiers: block refuses; warn and ok proceed (warn-tier footprint
    /// is surfaced by the guard's logging, not refused).
    public static func verdict(
        model: String, diskBytes: Int?, physicalRAM: UInt64,
        warnPct: Int, blockPct: Int, pressure: MemoryPressureLevel
    ) -> Verdict {
        if case .deferred(let reason) = pressureVerdict(pressure) {
            return .deferred(reason: reason)
        }
        let tier = tier(diskBytes: diskBytes, physicalRAM: physicalRAM,
                        warnPct: warnPct, blockPct: blockPct)
        guard tier == .block, let diskBytes else { return .allow }
        let est = estimatedBytes(diskBytes: diskBytes)
        return .block(reason:
            "\(model) needs \(footprintDescription(estimatedBytes: est, physicalRAM: physicalRAM)) est.; "
            + "block threshold is \(blockPct)% of \(gbString(Int(physicalRAM)))")
    }

    /// The shared "~X GB (~Y% of RAM)" footprint core — computed from ESTIMATED
    /// resident bytes — that the block reason, the guard's warn-tier log line, and
    /// the chooser's warn prompt all build their sentences around.
    public static func footprintDescription(estimatedBytes: Int, physicalRAM: UInt64) -> String {
        "~\(gbString(estimatedBytes)) (~\(ramPct(estimatedBytes, of: physicalRAM))% of RAM)"
    }

    /// The fit text + tier for a local model of known size; nil when the size (or
    /// tier) is unknown — callers render nothing. Hosts that store threshold
    /// overrides pass warnPct/blockPct; stenographer has no override UI yet, so it
    /// relies on the defaults.
    public static func fitInfo(
        diskBytes: Int?, physicalRAM: UInt64,
        warnPct: Int = defaultWarnPct, blockPct: Int = defaultBlockPct
    ) -> FitInfo? {
        guard let diskBytes,
              let tier = tier(diskBytes: diskBytes, physicalRAM: physicalRAM,
                              warnPct: warnPct, blockPct: blockPct)
        else { return nil }
        let est = estimatedBytes(diskBytes: diskBytes)
        switch tier {
        case .ok:
            return FitInfo(
                text: "\(gbString(diskBytes)) (~\(ramPct(est, of: physicalRAM))% of RAM)", tier: .ok)
        case .warn:
            return FitInfo(
                text: "\(gbString(diskBytes)) ⚠ large: ~\(ramPct(est, of: physicalRAM))% of RAM", tier: .warn)
        case .block:
            return FitInfo(
                text: "\(gbString(diskBytes)) — won't run: exceeds memory budget", tier: .block)
        }
    }

    /// The Model-popup label for a local model: plain size for ok, a warning for
    /// warn, "won't run" for block, the bare name when the size is unknown.
    /// Composed as "model — fit text" from `fitInfo`.
    public static func pickerLabel(
        model: String, diskBytes: Int?, physicalRAM: UInt64,
        warnPct: Int = defaultWarnPct, blockPct: Int = defaultBlockPct
    ) -> String {
        guard let info = fitInfo(diskBytes: diskBytes, physicalRAM: physicalRAM,
                                 warnPct: warnPct, blockPct: blockPct)
        else { return model }
        return "\(model) — \(info.text)"
    }

    public static func gbString(_ bytes: Int) -> String {
        String(format: "%.1f GB", locale: Locale(identifier: "en_US_POSIX"),
               Double(bytes) / 1_000_000_000)
    }

    public static func ramPct(_ bytes: Int, of physicalRAM: UInt64) -> Int {
        guard physicalRAM > 0 else { return 0 }
        return Int((Double(bytes) / Double(physicalRAM) * 100).rounded())
    }
}

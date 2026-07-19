import Testing
import Foundation
@testable import AIPluginKit

@Suite("ModelFitPolicy")
struct ModelFitPolicyTests {
    /// A 64 GB machine (the incident machine) for every case.
    private let ram: UInt64 = 64_000_000_000

    @Test("tier boundaries at 25/50% of RAM")
    func tierBoundaries() {
        // 12.5 GB disk → 15 GB est = 23.4% → ok (just under warn)
        #expect(ModelFitPolicy.tier(diskBytes: 12_500_000_000, physicalRAM: ram) == .ok)
        // 14 GB disk → 16.8 GB est = 26.25% → warn
        #expect(ModelFitPolicy.tier(diskBytes: 14_000_000_000, physicalRAM: ram) == .warn)
        // 27 GB disk → 32.4 GB est = 50.6% → block
        #expect(ModelFitPolicy.tier(diskBytes: 27_000_000_000, physicalRAM: ram) == .block)
        // The incident model: 51 GB disk → 61.2 GB est → block
        #expect(ModelFitPolicy.tier(diskBytes: 51_000_000_000, physicalRAM: ram) == .block)
        // deepseek-coder-v2:16b: 8.9 GB → 10.7 GB est = 16.7% → ok
        #expect(ModelFitPolicy.tier(diskBytes: 8_900_000_000, physicalRAM: ram) == .ok)
    }

    @Test("unknown size or zero RAM has no tier")
    func unknownSizeHasNoTier() {
        #expect(ModelFitPolicy.tier(diskBytes: nil, physicalRAM: ram) == nil)
        #expect(ModelFitPolicy.tier(diskBytes: 1, physicalRAM: 0) == nil)
    }

    @Test("verdict blocks an over-budget model with a human reason")
    func verdictBlocksOverBudgetModel() throws {
        let verdict = ModelFitPolicy.verdict(
            model: "qwen3-coder-next:latest", diskBytes: 51_000_000_000, physicalRAM: ram,
            warnPct: 25, blockPct: 50, pressure: .normal)
        guard case .block(let reason) = verdict else {
            Issue.record("expected block, got \(verdict)")
            return
        }
        #expect(reason.contains("qwen3-coder-next:latest"))
        #expect(reason.contains("61.2 GB"))
        #expect(reason.contains("50% of 64.0 GB"))
    }

    @Test("pressure defers even small or unknown-size models")
    func verdictDefersUnderPressure() {
        for diskBytes in [Int?.some(4_900_000_000), nil] {
            let verdict = ModelFitPolicy.verdict(
                model: "llama3.1:8b", diskBytes: diskBytes, physicalRAM: ram,
                warnPct: 25, blockPct: 50, pressure: .warning)
            guard case .deferred(let reason) = verdict else {
                Issue.record("expected deferred, got \(verdict)")
                return
            }
            #expect(reason.contains("memory pressure is warning"))
        }
    }

    @Test("ok, warn, and unknown-size models are allowed under normal pressure")
    func verdictAllowsOkWarnAndUnknownSize() {
        #expect(ModelFitPolicy.verdict(
            model: "m", diskBytes: 4_900_000_000, physicalRAM: ram,
            warnPct: 25, blockPct: 50, pressure: .normal) == .allow)
        // warn tier still runs (visibility, not refusal)
        #expect(ModelFitPolicy.verdict(
            model: "m", diskBytes: 20_000_000_000, physicalRAM: ram,
            warnPct: 25, blockPct: 50, pressure: .normal) == .allow)
        // unknown size fails open (non-ollama local servers)
        #expect(ModelFitPolicy.verdict(
            model: "m", diskBytes: nil, physicalRAM: ram,
            warnPct: 25, blockPct: 50, pressure: .normal) == .allow)
    }

    @Test("picker labels carry size, RAM share, and tier badges")
    func pickerLabels() {
        #expect(ModelFitPolicy.pickerLabel(
            model: "deepseek-coder-v2:16b", diskBytes: 8_900_000_000, physicalRAM: ram)
            == "deepseek-coder-v2:16b — 8.9 GB (~17% of RAM)")
        #expect(ModelFitPolicy.pickerLabel(
            model: "big", diskBytes: 20_000_000_000, physicalRAM: ram)
            == "big — 20.0 GB ⚠ large: ~38% of RAM")
        #expect(ModelFitPolicy.pickerLabel(
            model: "huge", diskBytes: 51_000_000_000, physicalRAM: ram)
            == "huge — 51.0 GB — won't run: exceeds memory budget")
        #expect(ModelFitPolicy.pickerLabel(
            model: "mystery", diskBytes: nil, physicalRAM: ram) == "mystery")
    }
}

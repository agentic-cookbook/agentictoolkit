import Testing
import Foundation
@testable import AIPluginKit

struct FixedMemory: SystemMemoryMonitoring {
    let physicalRAM: UInt64
    let pressureLevel: MemoryPressureLevel
}

@Suite("LocalInferenceGuard")
struct LocalInferenceGuardTests {
    private static let ram: UInt64 = 64_000_000_000
    private static let bigTags = Data("""
        {"models":[{"name":"big:latest","size":51000000000}]}
        """.utf8)

    private func makeGuard(tags: Data?, pressure: MemoryPressureLevel) -> LocalInferenceGuard {
        let catalog = LocalModelCatalog(fetcher: { _ in
            guard let tags else { throw URLError(.cannotConnectToHost) }
            return tags
        })
        return LocalInferenceGuard(
            catalog: catalog,
            memory: FixedMemory(physicalRAM: Self.ram, pressureLevel: pressure))
    }

    @Test("an over-budget model is blocked")
    func blocksOverBudgetModel() async {
        let guardActor = makeGuard(tags: Self.bigTags, pressure: .normal)
        let outcome = await guardActor.verdict(
            model: "big:latest", baseURL: "http://localhost:11434/v1", settings: { _ in nil })
        guard case .block = outcome else {
            Issue.record("expected block, got \(outcome)")
            return
        }
    }

    @Test("threshold overrides come from the settings reader")
    func thresholdOverridesComeFromSettings() async {
        // block threshold raised to 99% → the 51 GB model (95.6% est.) is allowed
        let guardActor = makeGuard(tags: Self.bigTags, pressure: .normal)
        let outcome = await guardActor.verdict(
            model: "big:latest", baseURL: "http://localhost:11434/v1",
            settings: { key in key == ModelFitPolicy.blockPctKey ? "99" : nil })
        #expect(outcome == .allow)
    }

    @Test("pressure defers even when the size is unknown")
    func defersUnderPressureEvenWithUnknownSize() async {
        let guardActor = makeGuard(tags: nil, pressure: .critical)
        let outcome = await guardActor.verdict(
            model: "any", baseURL: "http://localhost:11434/v1", settings: { _ in nil })
        guard case .deferred = outcome else {
            Issue.record("expected deferred, got \(outcome)")
            return
        }
    }

    @Test("unknown size fails open under normal pressure")
    func unknownSizeFailsOpen() async {
        let guardActor = makeGuard(tags: nil, pressure: .normal)
        let outcome = await guardActor.verdict(
            model: "any", baseURL: "http://localhost:11434/v1", settings: { _ in nil })
        #expect(outcome == .allow)
    }

    @Test("runExclusive serializes local inference (peak concurrency = 1)")
    func runExclusiveSerializes() async {
        let guardActor = makeGuard(tags: nil, pressure: .normal)
        let tracker = OverlapTracker()
        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<4 {
                group.addTask {
                    await guardActor.runExclusive {
                        await tracker.enter()
                        try? await Task.sleep(nanoseconds: 20_000_000)
                        await tracker.exit()
                    }
                }
            }
        }
        #expect(await tracker.maxConcurrent == 1)
    }
}

private actor OverlapTracker {
    private var current = 0
    var maxConcurrent = 0
    func enter() {
        current += 1
        maxConcurrent = Swift.max(maxConcurrent, current)
    }
    func exit() { current -= 1 }
}

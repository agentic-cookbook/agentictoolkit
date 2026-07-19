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
                    try? await guardActor.runExclusive {
                        await tracker.enter()
                        try? await Task.sleep(nanoseconds: 20_000_000)
                        await tracker.exit()
                    }
                }
            }
        }
        #expect(await tracker.maxConcurrent == 1)
    }

    @Test("waiters run in FIFO order via direct handoff")
    func waitersRunInFIFOOrder() async throws {
        let guardActor = makeGuard(tags: nil, pressure: .normal)
        let entered = Flag()
        let release = Flag()
        let order = OrderLog()
        let holder = Task {
            try await guardActor.runExclusive {
                await entered.raise()
                await release.wait()
            }
        }
        await entered.wait()
        // Park three waiters in a known order (each is confirmed parked before
        // the next starts), then let the holder finish.
        var waiters: [Task<Void, Error>] = []
        for index in 0..<3 {
            waiters.append(Task {
                try await guardActor.runExclusive { await order.append(index) }
            })
            while await guardActor.waiterCount < index + 1 {
                try await Task.sleep(nanoseconds: 1_000_000)
            }
        }
        await release.raise()
        for waiter in waiters { try await waiter.value }
        try await holder.value
        #expect(await order.values == [0, 1, 2])
    }

    @Test("a cancelled parked waiter throws promptly without running its operation")
    func cancelledParkedWaiterThrowsWithoutRunning() async throws {
        let guardActor = makeGuard(tags: nil, pressure: .normal)
        let entered = Flag()
        let release = Flag()
        let ran = Flag()
        let holder = Task {
            try await guardActor.runExclusive {
                await entered.raise()
                await release.wait()
            }
        }
        await entered.wait()
        let waiter = Task {
            try await guardActor.runExclusive { await ran.raise() }
        }
        while await guardActor.waiterCount < 1 {
            try await Task.sleep(nanoseconds: 1_000_000)
        }
        waiter.cancel()
        // The cancelled waiter unparks and throws while the holder still holds
        // the lock — no waiting for the critical section to end.
        let result = await waiter.result
        guard case .failure(let error) = result, error is CancellationError else {
            Issue.record("expected CancellationError, got \(result)")
            return
        }
        #expect(await guardActor.waiterCount == 0)
        #expect(await ran.isRaised == false)
        await release.raise()
        try await holder.value
    }

    @Test("the deadline cuts off a hung operation and the next waiter proceeds")
    func deadlineCutsOffHungOperation() async throws {
        let guardActor = makeGuard(tags: nil, pressure: .normal)
        let entered = Flag()
        let hung = Task {
            try await guardActor.runExclusive(deadline: 0.1) {
                await entered.raise()
                try await Task.sleep(nanoseconds: 60_000_000_000)  // "never" returns
            }
        }
        await entered.wait()
        let waiter = Task {
            try await guardActor.runExclusive { "ran" }
        }
        // The deadline fires, the hung op is cancelled, and the handoff still runs.
        #expect(try await waiter.value == "ran")
        let result = await hung.result
        guard case .failure(let error as AIGuardError) = result, case .deferred = error else {
            Issue.record("expected AIGuardError.deferred, got \(result)")
            return
        }
    }
}

private actor OrderLog {
    private(set) var values: [Int] = []
    func append(_ value: Int) { values.append(value) }
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

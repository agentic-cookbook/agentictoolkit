import Testing
import Foundation
@testable import AIPluginKit

@Suite("SystemMemoryMonitor")
struct SystemMemoryMonitorTests {

    @Test("DispatchSource events map to levels, critical winning")
    func eventLevelMapping() {
        #expect(SystemMemoryMonitor.level(for: .critical) == .critical)
        #expect(SystemMemoryMonitor.level(for: [.warning, .critical]) == .critical)
        #expect(SystemMemoryMonitor.level(for: .warning) == .warning)
        #expect(SystemMemoryMonitor.level(for: .normal) == .normal)
    }

    @Test("a coalesced raise+fall latches normal, not the raise")
    func coalescedRaiseAndFallLatchesNormal() {
        // The source fires on transitions: when a raise and a fall land in one
        // coalesced mask, the fall is the LATER event — .normal must win, or the
        // latch would read warning/critical forever after a momentary spike.
        #expect(SystemMemoryMonitor.level(for: [.warning, .normal]) == .normal)
        #expect(SystemMemoryMonitor.level(for: [.critical, .normal]) == .normal)
        #expect(SystemMemoryMonitor.level(for: [.warning, .critical, .normal]) == .normal)
    }

    @Test("live monitor reports real physical RAM")
    func liveMonitorReportsRealRAM() {
        // No assertion on pressureLevel: a loaded dev machine may genuinely be under
        // pressure, and the latch reflects reality.
        #expect(SystemMemoryMonitor().physicalRAM > 1_000_000_000)
    }
}

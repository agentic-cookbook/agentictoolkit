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

    @Test("live monitor reports real physical RAM")
    func liveMonitorReportsRealRAM() {
        // No assertion on pressureLevel: a loaded dev machine may genuinely be under
        // pressure, and the latch reflects reality.
        #expect(SystemMemoryMonitor().physicalRAM > 1_000_000_000)
    }
}

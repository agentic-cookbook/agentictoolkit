import Foundation

/// What the guard needs to know about this machine's memory. A protocol so tests
/// inject fixed RAM/pressure without a live DispatchSource.
public protocol SystemMemoryMonitoring: Sendable {
    var physicalRAM: UInt64 { get }
    var pressureLevel: MemoryPressureLevel { get }
}

/// Live implementation: total RAM from `ProcessInfo`, and the OS's own
/// memory-pressure signal latched from a DispatchSource for the process's lifetime.
/// The source fires on transitions, so the last event IS the current level
/// (`normal` until told otherwise).
public final class SystemMemoryMonitor: SystemMemoryMonitoring, @unchecked Sendable {
    public static let shared = SystemMemoryMonitor()

    public let physicalRAM = ProcessInfo.processInfo.physicalMemory

    private let lock = NSLock()
    private var latched: MemoryPressureLevel = .normal
    private let source: DispatchSourceMemoryPressure

    public var pressureLevel: MemoryPressureLevel {
        lock.withLock { latched }
    }

    public init() {
        source = DispatchSource.makeMemoryPressureSource(
            eventMask: [.normal, .warning, .critical],
            queue: DispatchQueue(label: "aipluginkit.memory-pressure")
        )
        source.setEventHandler { [weak self] in
            guard let self else { return }
            let level = Self.level(for: self.source.data)
            self.lock.withLock { self.latched = level }
        }
        source.activate()
    }

    static func level(for event: DispatchSource.MemoryPressureEvent) -> MemoryPressureLevel {
        if event.contains(.critical) { return .critical }
        if event.contains(.warning) { return .warning }
        return .normal
    }
}

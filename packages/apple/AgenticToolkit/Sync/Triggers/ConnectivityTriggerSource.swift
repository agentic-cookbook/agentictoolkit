import Foundation
import Network

/// Emits .connectivityRestored on each unsatisfied→satisfied transition.
/// Network.framework is available on both macOS and iOS — still daemon-safe.
/// This is the first and only place in this target that imports Network.
public final class ConnectivityTriggerSource: SyncTriggerSource, @unchecked Sendable {
    public let kicks: AsyncStream<SyncKickReason>
    private let continuation: AsyncStream<SyncKickReason>.Continuation
    private let monitor = NWPathMonitor()

    public init(queue: DispatchQueue = DispatchQueue(label: "ConnectivityTriggerSource")) {
        let (stream, continuation) = AsyncStream.makeStream(of: SyncKickReason.self)
        self.kicks = stream
        self.continuation = continuation
        nonisolated(unsafe) var wasSatisfied: Bool?
        monitor.pathUpdateHandler = { path in
            let satisfied = path.status == .satisfied
            if satisfied, wasSatisfied == false {
                continuation.yield(.connectivityRestored)
            }
            wasSatisfied = satisfied
        }
        monitor.start(queue: queue)
    }

    public func stop() {
        monitor.cancel()
        continuation.finish()
    }
}

import Foundation

/// Host-driven trigger: call `fire(_:)` to kick a sync cycle on demand.
public final class ManualTriggerSource: SyncTriggerSource, @unchecked Sendable {
    public let kicks: AsyncStream<SyncKickReason>
    private let continuation: AsyncStream<SyncKickReason>.Continuation

    public init() {
        (self.kicks, self.continuation) = AsyncStream.makeStream(of: SyncKickReason.self)
    }

    public func fire(_ reason: SyncKickReason) {
        continuation.yield(reason)
    }
}

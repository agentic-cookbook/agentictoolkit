import Foundation

/// Ticks `.periodic` on a fixed interval until `stop()` is called.
public final class PeriodicTriggerSource: SyncTriggerSource, @unchecked Sendable {
    public let kicks: AsyncStream<SyncKickReason>
    private let task: Task<Void, Never>
    private let continuation: AsyncStream<SyncKickReason>.Continuation

    public init(interval: TimeInterval) {
        let (stream, continuation) = AsyncStream.makeStream(of: SyncKickReason.self)
        self.kicks = stream
        self.continuation = continuation
        self.task = Task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(interval))
                guard !Task.isCancelled else { break }
                continuation.yield(.periodic)
            }
        }
    }

    public func stop() {
        task.cancel()
        continuation.finish()
    }

    // The task's closure captures no `self` (only the local `continuation`),
    // so calling `stop()` here is safe: it never resurrects `self` or
    // extends its lifetime, it just cancels/finishes state the task itself
    // already holds independently of this instance.
    deinit {
        stop()
    }
}

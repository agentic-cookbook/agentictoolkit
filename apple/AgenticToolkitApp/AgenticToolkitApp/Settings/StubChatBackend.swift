import Foundation
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Placeholder `ChatBackend` used while `AIPluginChatBackend` is parked pending
/// the per-plugin-secrets redesign. Reports "not ready" so the input stays
/// disabled, and fails any send attempt.
final class StubChatBackend: ChatBackend {
    var isReady: Bool { get async { false } }

    func isReadyChanges() -> AsyncStream<Bool> {
        AsyncStream { continuation in
            continuation.yield(false)
            continuation.finish()
        }
    }

    func sendMessages(_ messages: [ChatBackendMessage]) async -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish(throwing: StubChatError.notConfigured)
        }
    }

    enum StubChatError: Error { case notConfigured }
}

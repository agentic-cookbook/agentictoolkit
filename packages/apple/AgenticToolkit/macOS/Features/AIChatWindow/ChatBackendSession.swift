import Foundation
import AgenticToolkitCore

/// Adapts a legacy `ChatBackend` to the `ChatSession` contract so consumers that
/// still pass `makeBackend:` keep working during migration. Holds the transcript
/// itself (the old backend was stateless) and re-sends full history each turn.
///
/// Deprecated alongside `ChatBackend`; delete once all consumers pass `makeSession:`.
public final class ChatBackendSession: ChatSession, @unchecked Sendable {

    private let backend: ChatBackend
    private let lock = NSLock()
    private var continuation: AsyncStream<ChatEvent>.Continuation?
    private var history: [ChatBackendMessage] = []
    private var liveTurn: Task<Void, Never>?

    public init(backend: ChatBackend) { self.backend = backend }

    public func events() -> AsyncStream<ChatEvent> {
        AsyncStream { continuation in
            lock.lock(); self.continuation = continuation; lock.unlock()
            continuation.yield(.stateChanged(.ready))
            continuation.onTermination = { [weak self] _ in self?.liveTurn?.cancel() }
        }
    }

    public func send(_ text: String) {
        liveTurn = Task { [weak self] in await self?.runTurn(text) }
    }

    public func interrupt() { liveTurn?.cancel() }
    public func close() { liveTurn?.cancel(); withLock { continuation }?.finish() }

    private func runTurn(_ text: String) async {
        emit(.userMessage(ChatMessage(role: .user, text: text)))
        appendHistory(ChatBackendMessage(role: .user, content: text))
        emit(.stateChanged(.responding))

        let assistantID = UUID().uuidString
        var opened = false
        var turnText = ""
        let stream = await backend.sendMessages(snapshotHistory(), tools: [])
        do {
            for try await event in stream {
                switch event {
                case .textDelta(let chunk):
                    if !opened { emit(.responseStarted(messageID: assistantID)); opened = true }
                    turnText += chunk
                    emit(.responseDelta(messageID: assistantID, text: chunk))
                case .toolUse(let id, let name, _):
                    emit(.toolCall(messageID: assistantID, name: name, phase: .started))
                    _ = id
                case .end:
                    continue
                }
            }
            if !turnText.isEmpty { appendHistory(ChatBackendMessage(role: .assistant, content: turnText)) }
            if opened { emit(.responseFinished(messageID: assistantID, stopReason: nil)) }
            emit(.stateChanged(.ready))
        } catch {
            emit(.turnFailed(ChatError(message: "Sorry, something went wrong. Let's try again.", isRetryable: true)))
            emit(.stateChanged(.ready))
        }
    }

    private func emit(_ event: ChatEvent) { withLock { continuation }?.yield(event) }
    private func appendHistory(_ message: ChatBackendMessage) { lock.lock(); history.append(message); lock.unlock() }
    private func snapshotHistory() -> [ChatBackendMessage] { lock.lock(); defer { lock.unlock() }; return history }
    private func withLock<T>(_ body: () -> T) -> T { lock.lock(); defer { lock.unlock() }; return body() }
}

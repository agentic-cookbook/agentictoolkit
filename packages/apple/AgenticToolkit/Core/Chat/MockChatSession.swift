// Core/Chat/MockChatSession.swift
import Foundation

/// A scripted `ChatSession` for tests, previews, and demos. On `send`, it echoes
/// the user turn, then streams a canned reply in fixed-size chunks. No network,
/// no subprocess.
public final class MockChatSession: ChatSession, @unchecked Sendable {

    private let reply: String
    private let chunkSize: Int
    private let interChunkDelay: Duration

    private let lock = NSLock()
    private var continuation: AsyncStream<ChatEvent>.Continuation?
    private var liveTurn: Task<Void, Never>?

    public init(reply: String = "This is a mock reply.",
                chunkSize: Int = 3,
                interChunkDelay: Duration = .milliseconds(10)) {
        self.reply = reply
        self.chunkSize = chunkSize
        self.interChunkDelay = interChunkDelay
    }

    public func events() -> AsyncStream<ChatEvent> {
        AsyncStream { continuation in
            lock.lock()
            self.continuation = continuation
            lock.unlock()
            continuation.yield(.stateChanged(.ready))
            continuation.onTermination = { [weak self] _ in self?.liveTurn?.cancel() }
        }
    }

    public func send(_ text: String) {
        let cont = withLock { continuation }
        guard let cont else { return }
        cont.yield(.userMessage(ChatMessage(role: .user, text: text)))
        cont.yield(.stateChanged(.responding))

        let assistantID = UUID().uuidString
        let chunks = Self.chunk(reply, size: chunkSize)
        liveTurn = Task { [interChunkDelay] in
            cont.yield(.responseStarted(messageID: assistantID))
            for chunk in chunks {
                if Task.isCancelled { break }
                cont.yield(.responseDelta(messageID: assistantID, text: chunk))
                try? await Task.sleep(for: interChunkDelay)
            }
            cont.yield(.responseFinished(messageID: assistantID, stopReason: "end_turn"))
            cont.yield(.stateChanged(.ready))
        }
    }

    public func interrupt() { liveTurn?.cancel() }

    public func close() {
        liveTurn?.cancel()
        withLock { continuation }?.finish()
    }

    private static func chunk(_ str: String, size: Int) -> [String] {
        guard size > 0 else { return [str] }
        return stride(from: 0, to: str.count, by: size).map {
            let start = str.index(str.startIndex, offsetBy: $0)
            let end = str.index(start, offsetBy: size, limitedBy: str.endIndex) ?? str.endIndex
            return String(str[start..<end])
        }
    }

    private func withLock<Value>(_ body: () -> Value) -> Value {
        lock.lock(); defer { lock.unlock() }; return body()
    }
}

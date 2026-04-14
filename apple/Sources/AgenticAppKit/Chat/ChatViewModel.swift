import Foundation
import Combine
import os

/// Drives the chat window. Messages queue up and process sequentially
/// so rapid sends don't interleave.
@MainActor
public final class ChatViewModel: ObservableObject {

    @Published public var messages: [ChatMessage] = []
    @Published public var isTyping: Bool = false

    private let backend: ChatBackend

    private var queue: [String] = []
    private var isProcessing = false

    private let logger = Logger(subsystem: "com.agentictoolkit", category: "Chat")

    public init(backend: ChatBackend) {
        self.backend = backend
    }

    // MARK: - Public API

    public func sendMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        messages.append(ChatMessage(role: .user, text: trimmed))
        queue.append(trimmed)
        processQueue()
    }

    public func clearHistory() {
        messages.removeAll()
        queue.removeAll()
        isProcessing = false
        isTyping = false
    }

    // MARK: - Queue Processing

    private func processQueue() {
        guard !isProcessing, !queue.isEmpty else { return }
        isProcessing = true
        drainQueue()
    }

    private func drainQueue() {
        guard !queue.isEmpty else {
            isProcessing = false
            return
        }

        _ = queue.removeFirst()
        isTyping = true

        // Build history in the backend's neutral format
        let history: [ChatBackendMessage] = messages
            .filter { $0.role != .error }
            .map { msg in
                let role: ChatBackendMessage.Role = msg.role == .user ? .user : .assistant
                return ChatBackendMessage(role: role, content: msg.text)
            }

        let backend = self.backend
        Task { [weak self] in
            guard let self else { return }

            do {
                let stream = await backend.sendMessages(history)
                var result = ""
                for try await chunk in stream {
                    result += chunk
                }

                guard !result.isEmpty else {
                    self.isTyping = false
                    self.appendError("Empty response from AI.")
                    self.drainQueue()
                    return
                }

                self.isTyping = false
                self.messages.append(ChatMessage(role: .assistant, text: result))
                self.drainQueue()
            } catch {
                self.logger.error("Chat error: \(error.localizedDescription, privacy: .public)")
                self.isTyping = false
                self.appendError("Sorry, something went wrong. Let's try again.")
                self.drainQueue()
            }
        }
    }

    private func appendError(_ text: String) {
        isTyping = false
        messages.append(ChatMessage(role: .error, text: text))
    }
}

import Foundation
import Combine
import os
import AgenticPluginSDK

/// Drives the chat window. Messages queue up and process sequentially
/// so rapid sends don't interleave.
@MainActor
public final class ChatViewModel: ObservableObject {

    @Published public var messages: [ChatMessage] = []
    @Published public var isTyping: Bool = false

    private let pluginManager: PluginManager
    private weak var configProvider: ChatConfigProvider?

    private var queue: [String] = []
    private var isProcessing = false

    private let logger = Logger(subsystem: "com.agentictoolkit", category: "Chat")

    public init(pluginManager: PluginManager, configProvider: ChatConfigProvider) {
        self.pluginManager = pluginManager
        self.configProvider = configProvider
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

        guard let config = configProvider else {
            appendError("Configuration not available.")
            drainQueue()
            return
        }

        let pluginId = config.selectedPluginIdentifier
        let model = config.selectedModel
        let credentials = config.pluginCredentials

        // Build message history for the API
        let history: [LLMMessage] = messages
            .filter { $0.role != .error }
            .map { msg in
                let role: LLMMessage.Role = msg.role == .user ? .user : .assistant
                return LLMMessage(role: role, content: msg.text)
            }

        Task { [weak self] in
            guard let self else { return }

            do {
                let plugin = try self.pluginManager.loadPlugin(identifier: pluginId)
                let stream = plugin.sendMessages(
                    history,
                    model: model,
                    systemPrompt: nil,
                    maxTokens: 2048,
                    credentials: credentials
                )

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

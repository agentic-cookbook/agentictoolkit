import Foundation
import Combine
import MCP
import os
import AgenticToolkitCore

/// Drives the chat window. Messages queue up and process sequentially
/// so rapid sends don't interleave.
///
/// When constructed with an `MCPServerRegistry` and a non-empty `activeServerIds`,
/// the model's response stream is consumed event-by-event: text deltas append
/// assistant messages, `.toolUse` events are dispatched to the matching MCP
/// server, and the result is threaded back into the history before re-prompting
/// the model. Without a registry the loop runs once and emits a single text
/// turn — identical to the pre-tool behavior.
@MainActor
public final class ChatViewModel: ObservableObject {

    @Published public var messages: [ChatMessage] = []
    @Published public var isTyping: Bool = false
    @Published public var activeServerIds: Set<UUID> = []

    private let backend: ChatBackend
    public let registry: MCPServerRegistry?

    private var queue: [String] = []
    private var isProcessing = false

    /// Hard cap on tool-dispatch iterations per user message. A misbehaving
    /// model that keeps emitting tool calls without making progress will be
    /// cut off rather than spinning forever.
    private static let maxToolIterations = 8

    /// Tool-name separator for namespacing across servers. Anthropic and
    /// OpenAI both reject `.` in tool names, so a double-underscore is used
    /// instead.
    private static let toolNameSeparator = "__"

    public init(
        backend: ChatBackend,
        registry: MCPServerRegistry? = nil,
        activeServerIds: Set<UUID> = []
    ) {
        self.backend = backend
        self.registry = registry
        self.activeServerIds = activeServerIds
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

    /// Appends a centered notice that the model changed. Only shown once a
    /// conversation is under way, so switching the model before chatting stays
    /// silent. The notice is never sent back to the model as history.
    public func noteModelChanged(to model: String) {
        guard !messages.isEmpty else { return }
        messages.append(ChatMessage(role: .notice, text: "Model changed to \(model)"))
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

        let initialHistory = Self.backendHistory(from: messages)

        Task { [weak self] in
            guard let self else { return }
            await self.runTurn(history: initialHistory)
        }
    }

    private func runTurn(history initialHistory: [ChatBackendMessage]) async {
        var pendingMessages = initialHistory
        var producedAnyText = false

        do {
            for _ in 0..<Self.maxToolIterations {
                let toolPairs = await registry?.tools(forIds: activeServerIds) ?? []
                let attachedTools = Self.makeToolDefinitions(from: toolPairs)

                let stream = await backend.sendMessages(pendingMessages, tools: attachedTools)

                var turnText = ""
                var pendingToolUses: [(id: String, name: String, args: Data)] = []
                for try await event in stream {
                    switch event {
                    case .textDelta(let chunk):
                        turnText += chunk
                    case .toolUse(let id, let name, let args):
                        pendingToolUses.append((id: id, name: name, args: args))
                    case .end:
                        continue
                    }
                }

                if !turnText.isEmpty {
                    messages.append(ChatMessage(role: .assistant, text: turnText))
                    pendingMessages.append(ChatBackendMessage(role: .assistant, content: turnText))
                    producedAnyText = true
                }

                if pendingToolUses.isEmpty { break }

                for use in pendingToolUses {
                    pendingMessages.append(
                        .toolUse(id: use.id, name: use.name, argumentsJSON: use.args)
                    )
                    let result = await runToolCall(use: use, pairs: toolPairs)
                    pendingMessages.append(
                        .toolResult(id: use.id, content: result.content, isError: result.isError)
                    )
                }
            }

            isTyping = false
            if !producedAnyText {
                appendError("Empty response from AI.")
            }
            drainQueue()
        } catch {
            Self.logger.error("Chat error: \(error.localizedDescription, privacy: .public)")
            isTyping = false
            appendError(Self.userFacingMessage(for: error))
            drainQueue()
        }
    }

    private func runToolCall(
        use: (id: String, name: String, args: Data),
        pairs: [(any MCPClientProtocol, MCP.Tool)]
    ) async -> (content: String, isError: Bool) {
        guard let pair = pairs.first(where: {
            Self.namespacedName(server: $0.0.name, tool: $0.1.name) == use.name
        }) else {
            return ("Unknown tool: \(use.name)", true)
        }
        let client = pair.0
        let originalName = pair.1.name
        let arguments = try? JSONDecoder().decode([String: Value].self, from: use.args)
        do {
            let (content, isError) = try await client.callTool(name: originalName, arguments: arguments)
            return (Self.flatten(content: content), isError)
        } catch {
            return ("Tool error: \(error.localizedDescription)", true)
        }
    }

    private static func makeToolDefinitions(
        from pairs: [(any MCPClientProtocol, MCP.Tool)]
    ) -> [ToolDefinition] {
        pairs.compactMap { client, tool in
            guard let schema = try? JSONEncoder().encode(tool.inputSchema) else { return nil }
            return ToolDefinition(
                name: namespacedName(server: client.name, tool: tool.name),
                description: tool.description ?? "",
                parametersJSONSchema: schema
            )
        }
    }

    private static func namespacedName(server: String, tool: String) -> String {
        "\(server)\(toolNameSeparator)\(tool)"
    }

    private static func flatten(content: [MCP.Tool.Content]) -> String {
        content.compactMap { item -> String? in
            if case let .text(text, _, _) = item {
                return text
            }
            return nil
        }
        .joined(separator: "\n")
    }

    private func appendError(_ text: String) {
        isTyping = false
        messages.append(ChatMessage(role: .error, text: text))
    }

    /// The conversation to send the backend: user/assistant turns only. Error and
    /// notice lines are UI-only and never fed back to the model.
    static func backendHistory(from messages: [ChatMessage]) -> [ChatBackendMessage] {
        messages
            .filter { $0.role != .error && $0.role != .notice }
            .map { msg in
                let role: ChatBackendMessage.Role = msg.role == .user ? .user : .assistant
                return ChatBackendMessage(role: role, content: msg.text)
            }
    }

    /// Turns a thrown backend error into a message that names what actually went
    /// wrong (HTTP status text, "model not found", etc.) instead of a generic
    /// apology. `LocalizedError` conformers (the transport + plugin errors) carry
    /// the useful text in `errorDescription`.
    static func userFacingMessage(for error: Error) -> String {
        let detail = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        let trimmed = detail.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Request failed." : "Request failed: \(trimmed)"
    }
}

extension ChatViewModel: Loggable {
    public static nonisolated let logger = makeLogger()
}

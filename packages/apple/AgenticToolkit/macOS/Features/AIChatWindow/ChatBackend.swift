import Foundation

/// A message in a chat conversation passed between the chat UI and a backend.
/// Plain value type — backends translate this into their own wire format.
///
/// Tool turns ride on the `.toolUse` / `.toolResult` roles, which carry their
/// associated data via the optional payload fields below.
public struct ChatBackendMessage: Sendable, Equatable {
    public enum Role: Sendable, Equatable {
        case user
        case assistant
        case system
        case toolUse
        case toolResult
    }

    public let role: Role
    public let content: String
    public let toolUseId: String?
    public let toolName: String?
    public let toolArgumentsJSON: Data?
    public let toolIsError: Bool?

    public init(role: Role, content: String) {
        self.init(
            role: role,
            content: content,
            toolUseId: nil,
            toolName: nil,
            toolArgumentsJSON: nil,
            toolIsError: nil
        )
    }

    private init(
        role: Role,
        content: String,
        toolUseId: String?,
        toolName: String?,
        toolArgumentsJSON: Data?,
        toolIsError: Bool?
    ) {
        self.role = role
        self.content = content
        self.toolUseId = toolUseId
        self.toolName = toolName
        self.toolArgumentsJSON = toolArgumentsJSON
        self.toolIsError = toolIsError
    }

    public static func toolUse(id: String, name: String, argumentsJSON: Data) -> ChatBackendMessage {
        ChatBackendMessage(
            role: .toolUse,
            content: "",
            toolUseId: id,
            toolName: name,
            toolArgumentsJSON: argumentsJSON,
            toolIsError: nil
        )
    }

    public static func toolResult(id: String, content: String, isError: Bool) -> ChatBackendMessage {
        ChatBackendMessage(
            role: .toolResult,
            content: content,
            toolUseId: id,
            toolName: nil,
            toolArgumentsJSON: nil,
            toolIsError: isError
        )
    }
}

/// A backend that a chat UI can talk to. Implementations translate the abstract
/// request into whatever concrete API they use (LLM plugin, direct HTTP, mock, etc).
///
/// The chat UI depends only on this protocol — not on any specific plugin or SDK.
///
/// Conformers choose their own actor isolation. A UI-driven backend may be
/// `@MainActor`; an HTTP-driven backend may be an `actor` of its own. The
/// chat UI awaits both `isReady` and `sendMessages`, so either works.
///
/// - Important: Deprecated. New code conforms to `ChatSession` (e.g.
///   `LocalChatSession`). This rides `ChatBackendSession` until AgenticToolkitApp
///   and Whippet migrate, then it (and `WhippetChatBackend`) are deleted.
public protocol ChatBackend: AnyObject, Sendable {
    /// Whether the backend is currently ready to accept messages. The chat UI
    /// uses this to enable or disable the input field (e.g. disable when no
    /// provider is configured or credentials are missing).
    var isReady: Bool { get async }

    /// Returns a fresh async stream of `isReady` values. Each call produces an
    /// independent stream, so multiple consumers can observe readiness
    /// concurrently. Each stream yields the current value first, then a new
    /// value whenever readiness changes (credentials arrive, network state
    /// changes, the user picks a different provider).
    ///
    /// A stream ends when its consumer cancels the iterating task or when the
    /// backend is deinitialized. Backends that never change readiness may
    /// yield the initial value once and finish immediately.
    func isReadyChanges() -> AsyncStream<Bool>

    /// Streams an assistant response for the given conversation.
    ///
    /// - Parameter messages: The full conversation so far, user/assistant turns
    ///   plus any system messages the backend cares about.
    /// - Returns: An async stream of text chunks. Concatenate to form the full
    ///   assistant reply. The stream finishes when the response is complete, or
    ///   throws if the backend fails.
    func sendMessages(_ messages: [ChatBackendMessage]) async -> AsyncThrowingStream<String, Error>

    /// Streams an assistant response for a tool-aware request.
    ///
    /// Backends that support function calling override this to translate
    /// `tools` into the provider's tool format and emit `.toolUse` events when
    /// the model requests a call. The default implementation delegates to the
    /// text-only `sendMessages` and surfaces every chunk as `.textDelta`,
    /// followed by a single `.end(stopReason: nil)`.
    func sendMessages(
        _ messages: [ChatBackendMessage],
        tools: [ToolDefinition]
    ) async -> AsyncThrowingStream<ChatStreamEvent, Error>
}

extension ChatBackend {
    public func sendMessages(
        _ messages: [ChatBackendMessage],
        tools: [ToolDefinition]
    ) async -> AsyncThrowingStream<ChatStreamEvent, Error> {
        let textStream = await sendMessages(messages)
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await chunk in textStream {
                        continuation.yield(.textDelta(chunk))
                    }
                    continuation.yield(.end(stopReason: nil))
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

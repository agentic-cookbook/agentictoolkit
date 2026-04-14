import Foundation

/// A message in a chat conversation passed between the chat UI and a backend.
/// Plain value type — backends translate this into their own wire format.
public struct ChatBackendMessage: Sendable, Equatable {
    public enum Role: Sendable, Equatable {
        case user
        case assistant
        case system
    }

    public let role: Role
    public let content: String

    public init(role: Role, content: String) {
        self.role = role
        self.content = content
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
}

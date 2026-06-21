// Core/Chat/ChatMessage.swift
import Foundation

/// A single message in a chat transcript. `text` is mutable so streaming
/// deltas grow the in-flight assistant message in place; `isStreaming` is true
/// between `responseStarted` and `responseFinished` so the view can show a caret.
public struct ChatMessage: Identifiable, Equatable, Sendable {
    public let id: String
    public let role: Role
    public var text: String
    public var isStreaming: Bool
    public let timestamp: Date

    public enum Role: Sendable, Equatable {
        case user
        case assistant
        case error
        /// A centered, muted status line (e.g. "Model changed to …"). Rendered
        /// inline but never sent back to the model as conversation history.
        case notice
    }

    public init(
        id: String = UUID().uuidString,
        role: Role,
        text: String,
        isStreaming: Bool = false,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.isStreaming = isStreaming
        self.timestamp = timestamp
    }
}

extension ChatMessage.Role {
    /// The lowercase label the AppleScript transcript commands use for this role.
    /// One source of truth so the two scripting call sites can't drift apart.
    public var scriptingLabel: String {
        switch self {
        case .user: return "user"
        case .assistant: return "assistant"
        case .error: return "error"
        case .notice: return "notice"
        }
    }
}

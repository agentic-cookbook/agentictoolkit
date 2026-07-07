import Foundation

/// A single message in a chat conversation.
public struct ChatMessage: Identifiable, Equatable {
    public let id: String
    public let role: Role
    public let text: String
    public let timestamp: Date

    public enum Role: Equatable {
        case user
        case assistant
        case error
        /// A centered, muted status line (e.g. "Model changed to …"). Rendered
        /// inline but never sent back to the model as conversation history.
        case notice
    }

    public init(role: Role, text: String, timestamp: Date = Date()) {
        self.id = UUID().uuidString
        self.role = role
        self.text = text
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

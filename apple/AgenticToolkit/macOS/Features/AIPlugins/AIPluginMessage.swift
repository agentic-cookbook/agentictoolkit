import Foundation

/// A single message in an LLM conversation.
public struct AIPluginMessage: Sendable {
    public let role: Role
    public let content: String

    public enum Role: String, Sendable {
        case user
        case assistant
        case system
    }

    public init(role: Role, content: String) {
        self.role = role
        self.content = content
    }
}

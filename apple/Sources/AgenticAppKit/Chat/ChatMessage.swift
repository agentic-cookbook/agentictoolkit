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
    }

    public init(role: Role, text: String, timestamp: Date = Date()) {
        self.id = UUID().uuidString
        self.role = role
        self.text = text
        self.timestamp = timestamp
    }
}

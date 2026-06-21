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

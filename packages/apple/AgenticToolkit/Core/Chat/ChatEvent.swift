// Core/Chat/ChatEvent.swift
import Foundation

public enum ToolPhase: Sendable, Equatable { case started, completed }

/// Everything a `ChatSession` tells the UI. Non-throwing by design: a failed
/// turn is `turnFailed`, not stream termination, so the session survives it.
public enum ChatEvent: Sendable, Equatable {
    case stateChanged(ChatSessionState)
    case transcriptLoaded([ChatMessage])
    case userMessage(ChatMessage)
    case responseStarted(messageID: ChatMessage.ID)
    case responseDelta(messageID: ChatMessage.ID, text: String)
    case toolCall(messageID: ChatMessage.ID, name: String, phase: ToolPhase)
    case responseFinished(messageID: ChatMessage.ID, stopReason: String?)
    case turnFailed(ChatError)
}

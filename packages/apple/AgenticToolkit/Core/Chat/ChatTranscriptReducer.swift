// Core/Chat/ChatTranscriptReducer.swift
import Foundation

/// Pure fold of a `ChatEvent` into transcript + session state. No UI, no actor —
/// this is the entire testable core of how the chat UI reacts to a session.
public enum ChatTranscriptReducer {

    public static func apply(
        _ event: ChatEvent,
        to messages: inout [ChatMessage],
        state: inout ChatSessionState
    ) {
        switch event {
        case .stateChanged(let newState):
            state = newState

        case .transcriptLoaded(let history):
            messages = history

        case .userMessage(let message):
            messages.append(message)

        case .responseStarted(let id):
            messages.append(ChatMessage(id: id, role: .assistant, text: "", isStreaming: true))

        case .responseDelta(let id, let text):
            mutate(id, in: &messages) { $0.text += text }

        case .toolCall:
            // Phase 1: no inline tool rendering. The event is retained in the
            // contract for the remote phase that exercises it.
            break

        case .responseFinished(let id, _):
            mutate(id, in: &messages) { $0.isStreaming = false }

        case .turnFailed(let error):
            messages.append(ChatMessage(role: .error, text: error.message))
        }
    }

    private static func mutate(
        _ id: ChatMessage.ID,
        in messages: inout [ChatMessage],
        _ change: (inout ChatMessage) -> Void
    ) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        change(&messages[index])
    }
}

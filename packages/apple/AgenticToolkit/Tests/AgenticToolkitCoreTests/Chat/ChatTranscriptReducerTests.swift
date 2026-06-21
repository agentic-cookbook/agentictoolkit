// Tests/AgenticToolkitCoreTests/Chat/ChatTranscriptReducerTests.swift
import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("ChatTranscriptReducer")
struct ChatTranscriptReducerTests {

    private func fold(_ events: [ChatEvent]) -> (messages: [ChatMessage], state: ChatSessionState) {
        var messages: [ChatMessage] = []
        var state: ChatSessionState = .connecting
        for event in events { ChatTranscriptReducer.apply(event, to: &messages, state: &state) }
        return (messages, state)
    }

    @Test("deltas grow the bubble named by responseStarted")
    func deltasGrowNamedBubble() {
        let (messages, _) = fold([
            .userMessage(ChatMessage(role: .user, text: "hi")),
            .responseStarted(messageID: "a"),
            .responseDelta(messageID: "a", text: "Hel"),
            .responseDelta(messageID: "a", text: "lo"),
            .responseFinished(messageID: "a", stopReason: nil)
        ])
        #expect(messages.count == 2)
        #expect(messages[1].id == "a")
        #expect(messages[1].text == "Hello")
        #expect(messages[1].isStreaming == false)
        #expect(messages[1].role == .assistant)
    }

    @Test("delta for an unknown id is ignored, not crashing")
    func unknownIdIgnored() {
        let (messages, _) = fold([.responseDelta(messageID: "ghost", text: "x")])
        #expect(messages.isEmpty)
    }

    @Test("turnFailed appends an error message and leaves transcript intact")
    func turnFailedAppendsError() {
        let (messages, _) = fold([
            .userMessage(ChatMessage(role: .user, text: "hi")),
            .turnFailed(ChatError(message: "boom", isRetryable: true))
        ])
        #expect(messages.count == 2)
        #expect(messages[1].role == .error)
        #expect(messages[1].text == "boom")
    }

    @Test("transcriptLoaded replaces the whole transcript")
    func transcriptLoadedReplaces() {
        let (messages, _) = fold([
            .userMessage(ChatMessage(role: .user, text: "stale")),
            .transcriptLoaded([ChatMessage(role: .assistant, text: "restored")])
        ])
        #expect(messages.count == 1)
        #expect(messages[0].text == "restored")
    }

    @Test("stateChanged updates state")
    func stateChangedUpdates() {
        let (_, state) = fold([.stateChanged(.ready)])
        #expect(state == .ready)
    }
}

// Tests/AgenticToolkitMacOSTests/Chat/ChatViewModelTests.swift
import Testing
import Foundation
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("ChatViewModel")
@MainActor
struct ChatViewModelTests {

    @Test("folds a mock session's stream into a growing transcript")
    func foldsMockStream() async {
        let viewModel = ChatViewModel(session: MockChatSession(reply: "Hello", chunkSize: 2))
        try? await Task.sleep(for: .milliseconds(20))
        viewModel.sendMessage("hi")

        // wait until the assistant message is complete
        for _ in 0..<200 {
            if viewModel.messages.last?.role == .assistant, viewModel.messages.last?.isStreaming == false { break }
            try? await Task.sleep(for: .milliseconds(10))
        }

        guard viewModel.messages.count == 2 else {
            Issue.record("expected 2 messages, got \(viewModel.messages.count)")
            return
        }
        let user = viewModel.messages[0]
        let assistant = viewModel.messages[1]
        #expect(user.role == .user)
        #expect(user.text == "hi")
        #expect(assistant.role == .assistant)
        #expect(assistant.text == "Hello")
        #expect(assistant.isStreaming == false)
    }

    @Test("noteModelChanged appends a notice once a chat is under way")
    func noteModelChangedWhenActive() async {
        let viewModel = ChatViewModel(session: MockChatSession(reply: "Hello", chunkSize: 2))
        try? await Task.sleep(for: .milliseconds(20))
        viewModel.sendMessage("hi")

        for _ in 0..<200 {
            if !viewModel.messages.isEmpty { break }
            try? await Task.sleep(for: .milliseconds(10))
        }
        let before = viewModel.messages.count

        viewModel.noteModelChanged(to: "opus")
        #expect(viewModel.messages.count == before + 1)
        #expect(viewModel.messages.last?.role == .notice)
        #expect(viewModel.messages.last?.text == "Model changed to opus")
    }

    @Test("noteModelChanged stays silent before any messages")
    func noteModelChangedWhenIdle() {
        let viewModel = ChatViewModel(session: MockChatSession(reply: "Hello", chunkSize: 2))
        viewModel.noteModelChanged(to: "opus")
        #expect(viewModel.messages.isEmpty)
    }
}

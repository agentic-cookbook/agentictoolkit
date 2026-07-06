import Foundation
import Testing
import AIPluginKit
import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("ChatViewModel")
@MainActor
struct ChatViewModelTests {

    /// Minimal backend so a view model can be constructed; the tests exercise
    /// synchronous, backend-independent behavior.
    private final class StubBackend: ChatBackend, @unchecked Sendable {
        var isReady: Bool { get async { true } }
        func isReadyChanges() -> AsyncStream<Bool> { AsyncStream { $0.finish() } }
        func sendMessages(_ messages: [ChatBackendMessage]) async -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
    }

    private func makeViewModel() -> ChatViewModel { ChatViewModel(backend: StubBackend()) }

    @Test("backendHistory drops error/notice lines and maps roles")
    func historyFiltersUiOnlyLines() {
        let messages = [
            ChatMessage(role: .user, text: "hi"),
            ChatMessage(role: .assistant, text: "hello"),
            ChatMessage(role: .notice, text: "Model changed to opus"),
            ChatMessage(role: .error, text: "Request failed: boom"),
            ChatMessage(role: .user, text: "again")
        ]
        let history = ChatViewModel.backendHistory(from: messages)
        #expect(history.map(\.content) == ["hi", "hello", "again"])
        #expect(history.map(\.role) == [.user, .assistant, .user])
    }

    @Test("noteModelChanged appends a notice once a chat is under way")
    func noteModelChangedWhenActive() {
        let viewModel = makeViewModel()
        viewModel.messages = [ChatMessage(role: .user, text: "hi")]
        viewModel.noteModelChanged(to: "opus")
        #expect(viewModel.messages.count == 2)
        #expect(viewModel.messages.last?.role == .notice)
        #expect(viewModel.messages.last?.text == "Model changed to opus")
    }

    @Test("noteModelChanged stays silent before any messages")
    func noteModelChangedWhenIdle() {
        let viewModel = makeViewModel()
        viewModel.noteModelChanged(to: "opus")
        #expect(viewModel.messages.isEmpty)
    }

    @Test("userFacingMessage surfaces the transport error detail")
    func surfacesTransportDetail() {
        let error = PluginTransport.TransportError.http(status: 404, message: "model 'llama3.2' not found")
        #expect(ChatViewModel.userFacingMessage(for: error) == "Request failed: model 'llama3.2' not found")
    }

    @Test("userFacingMessage falls back when the error has no description")
    func fallsBackWithoutDetail() {
        struct Blank: Error {}
        #expect(ChatViewModel.userFacingMessage(for: Blank()).hasPrefix("Request failed"))
    }
}

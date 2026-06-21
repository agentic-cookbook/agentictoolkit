import Foundation
import Combine
import os
import AgenticToolkitCore

/// Drives the chat window by folding a `ChatSession`'s event stream into an
/// observable transcript. All chat logic (turns, tools, transport) lives in the
/// session; this type only owns UI state and the reducer pump.
@MainActor
public final class ChatViewModel: ObservableObject {

    @Published public private(set) var messages: [ChatMessage] = []
    @Published public private(set) var state: ChatSessionState = .connecting

    /// True while a turn is in flight — kept for the existing view bindings that
    /// referenced `isTyping`.
    public var isTyping: Bool { if case .responding = state { return true } else { return false } }

    private let session: any ChatSession
    private var pump: Task<Void, Never>?

    public init(session: any ChatSession) {
        self.session = session
        pump = Task { [weak self] in
            guard let stream = self?.session.events() else { return }
            for await event in stream {
                guard let self else { return }
                self.apply(event)
            }
        }
    }

    deinit { pump?.cancel() }

    // MARK: - Public API

    public func sendMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        session.send(trimmed)
    }

    public func interrupt() { session.interrupt() }

    public func clearHistory() { messages.removeAll() }

    // MARK: - Reducer pump

    private func apply(_ event: ChatEvent) {
        ChatTranscriptReducer.apply(event, to: &messages, state: &state)
    }
}

extension ChatViewModel: Loggable {
    public static nonisolated let logger = makeLogger()
}

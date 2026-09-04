import Foundation
import Combine
import os
import AgenticToolkitCore

/// Drives the chat window by folding a `ChatSession`'s event stream into an
/// observable transcript. All chat logic (turns, tools, transport) lives in the
/// session; this type only owns UI state and the reducer pump.
///
/// Named `AIChatViewModel`, not `ChatViewModel`, because
/// `AgenticDeveloperToolkitUI` declares a `ChatViewModel` protocol and this
/// framework `@_exported import`s it: two Swift types of one name, ambiguous
/// for any consumer that imports both. See ``AIChatBubbleView`` for the same
/// decision.
@MainActor
public final class AIChatViewModel: ObservableObject {

    @Published public private(set) var messages: [ChatMessage] = []
    @Published public private(set) var state: ChatSessionState = .connecting

    /// True while a turn is in flight — kept for the existing view bindings that
    /// referenced `isTyping`.
    public var isTyping: Bool { if case .responding = state { return true } else { return false } }

    /// True while an assistant response is streaming.
    public var isResponding: Bool { if case .responding = state { true } else { false } }

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
        guard !isResponding else { return }
        session.send(trimmed)
    }

    public func interrupt() { session.interrupt() }

    public func clearHistory() {
        session.clear()
        messages.removeAll()
    }

    /// Appends a centered notice that the model changed. Only shown once a
    /// conversation is under way, so switching the model before chatting stays
    /// silent. Notices live only in this transcript — the session owns the
    /// history it sends the model — so they are never fed back as context.
    public func noteModelChanged(to model: String) {
        guard !messages.isEmpty else { return }
        messages.append(ChatMessage(role: .notice, text: "Model changed to \(model)"))
    }

    // MARK: - Reducer pump

    private func apply(_ event: ChatEvent) {
        ChatTranscriptReducer.apply(event, to: &messages, state: &state)
    }
}

extension AIChatViewModel: Loggable {
    public static nonisolated let logger = makeLogger()
}

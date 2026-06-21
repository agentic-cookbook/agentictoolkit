// Core/Chat/ChatSession.swift
import Foundation

/// The wire between a chat UI and any chat engine. Headless and transport-
/// agnostic: implementations may spawn a subprocess, replay a script, or hold a
/// remote SSE connection. The UI builds its observable state by folding
/// `events()` (see `ChatTranscriptReducer`).
public protocol ChatSession: Sendable {
    /// One long-lived stream of everything the UI reacts to. Subscribe once.
    /// Ends only after `close()`.
    func events() -> AsyncStream<ChatEvent>

    /// Send a user turn. Returns immediately; effects arrive as events.
    func send(_ text: String)

    /// Interrupt the in-flight assistant response. No-op if none is running.
    func interrupt()

    /// Tear down: terminate the subprocess / drop the connection. Ends `events()`.
    func close()
}

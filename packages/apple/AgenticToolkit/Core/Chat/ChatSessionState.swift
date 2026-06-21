// Core/Chat/ChatSessionState.swift
import Foundation

/// A user-facing failure. `isRetryable` tells the UI whether offering a retry
/// makes sense (rate limit / transient) vs. not (misconfiguration).
public struct ChatError: Error, Sendable, Equatable {
    public let message: String
    public let isRetryable: Bool
    public init(message: String, isRetryable: Bool) {
        self.message = message
        self.isRetryable = isRetryable
    }

    /// Builds a failure that names what actually went wrong (HTTP status text,
    /// "model not found", …) instead of a generic apology. `LocalizedError`
    /// conformers — the transport and plugin errors — carry the useful text in
    /// `errorDescription`.
    public init(from error: Error, isRetryable: Bool) {
        self.init(message: Self.userFacingMessage(for: error), isRetryable: isRetryable)
    }

    static func userFacingMessage(for error: Error) -> String {
        let detail = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        let trimmed = detail.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Request failed." : "Request failed: \(trimmed)"
    }
}

/// Lifecycle of a chat session. Drives input-enable + spinner in the UI.
public enum ChatSessionState: Sendable, Equatable {
    case connecting          // opened, not yet ready (remote handshake/auth)
    case ready               // idle, accepting input
    case responding          // a turn is in flight
    case failed(ChatError)   // fatal: cannot continue without intervention
    case closed
}

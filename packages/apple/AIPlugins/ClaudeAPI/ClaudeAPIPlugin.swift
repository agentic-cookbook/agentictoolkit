import Foundation
import AIPluginKit

/// LLM plugin for the Anthropic Messages API with SSE streaming.
///
/// Foundation-only: it *describes* the HTTP request and *decodes* the SSE
/// response. The host owns the transport, the settings UI (generated from
/// `descriptor.json`), and the API key (injected through `AIChatContext.config`).
public final class ClaudeAPIPlugin: NSObject, AIPlugin, @unchecked Sendable {

    public override init() { super.init() }

    public func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
        guard let apiKey = context.config.apiKey, !apiKey.isEmpty else {
            throw PluginError.missingAPIKey
        }
        guard let url = URL(string: "https://api.anthropic.com/v1/messages") else {
            throw PluginError.invalidURL
        }

        let model = context.model.isEmpty ? "claude-haiku-4-5-20251001" : context.model
        let apiMessages = context.messages
            .filter { $0.role != .system }
            .map { message -> [String: String] in
                ["role": message.role == .assistant ? "assistant" : "user", "content": message.content]
            }

        var body: [String: Any] = [
            "model": model,
            "max_tokens": context.maxTokens,
            "messages": apiMessages,
            "stream": true
        ]
        if let systemPrompt = context.systemPrompt, !systemPrompt.isEmpty {
            body["system"] = systemPrompt
        }

        return .http(
            method: .post,
            url: url,
            headers: [
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json"
            ],
            body: try JSONSerialization.data(withJSONObject: body)
        )
    }

    public func makeDecoder() -> any AIStreamDecoder { ClaudeSSEDecoder() }

    public func describeError(status: Int, body: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: body) as? [String: Any],
              let error = json["error"] as? [String: Any],
              let message = error["message"] as? String else {
            return nil
        }
        return message
    }

    enum PluginError: Error, LocalizedError {
        case missingAPIKey
        case invalidURL

        var errorDescription: String? {
            switch self {
            case .missingAPIKey: return "An Anthropic API key is required."
            case .invalidURL: return "The Anthropic API URL is invalid."
            }
        }
    }
}

/// Decodes the Anthropic Messages API server-sent-event stream. Each `data:`
/// line carries a JSON event; `content_block_delta` events contribute text.
final class ClaudeSSEDecoder: AIStreamDecoder {

    private var buffer = Data()

    func consume(_ data: Data) -> [AIStreamEvent] {
        buffer.append(data)
        return drainLines(flushRemainder: false)
    }

    func finish() -> [AIStreamEvent] {
        drainLines(flushRemainder: true)
    }

    private func drainLines(flushRemainder: Bool) -> [AIStreamEvent] {
        var events: [AIStreamEvent] = []
        while let newline = buffer.firstIndex(of: 0x0A) {
            let lineData = Data(buffer[buffer.startIndex..<newline])
            buffer.removeSubrange(buffer.startIndex...newline)
            if let event = parse(lineData) { events.append(event) }
        }
        if flushRemainder, !buffer.isEmpty {
            if let event = parse(buffer) { events.append(event) }
            buffer.removeAll()
        }
        return events
    }

    private func parse(_ lineData: Data) -> AIStreamEvent? {
        guard let line = String(data: lineData, encoding: .utf8) else { return nil }
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.hasPrefix("data: ") else { return nil }

        let payload = String(trimmed.dropFirst(6))
        if payload == "[DONE]" { return .end(stopReason: nil) }

        guard let json = try? JSONSerialization.jsonObject(with: Data(payload.utf8)) as? [String: Any],
              let eventType = json["type"] as? String else {
            return nil
        }

        switch eventType {
        case "content_block_delta":
            if let delta = json["delta"] as? [String: Any], let text = delta["text"] as? String {
                return .textDelta(text)
            }
        case "message_stop":
            return .end(stopReason: nil)
        default:
            break
        }
        return nil
    }
}

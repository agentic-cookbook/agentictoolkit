import Foundation
import AIPluginKit

/// LLM plugin for OpenAI-compatible endpoints (LM Studio, self-hosted, etc.).
///
/// Foundation-only and self-contained: it reads the user-supplied base URL and
/// API key from `AIChatContext.config`, describes the Chat Completions request,
/// and decodes the JSON reply. Kept independent of the official OpenAI plugin so
/// each `.aiplugin` bundle stands alone.
public final class OpenAICompatiblePlugin: NSObject, AIPlugin, @unchecked Sendable {

    public override init() { super.init() }

    public func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
        guard let baseURL = context.config.baseURL?.trimmingCharacters(in: .whitespacesAndNewlines),
              !baseURL.isEmpty else {
            throw PluginError.missingBaseURL
        }
        // Templates ship a versioned base URL (e.g. .../v1). Tolerate a base URL that
        // ISN'T versioned too — earlier builds appended "v1/chat/completions" to a
        // bare host, so a migrated/hand-entered base URL may lack the version segment;
        // append it here rather than 404ing on `.../chat/completions`.
        let endpoint = Self.isVersioned(baseURL) ? "chat/completions" : "v1/chat/completions"
        guard let url = URL(string: baseURL)?.appendingPathComponent(endpoint) else {
            throw PluginError.invalidURL
        }

        var messages: [[String: String]] = []
        if let systemPrompt = context.systemPrompt, !systemPrompt.isEmpty {
            messages.append(["role": "system", "content": systemPrompt])
        }
        for message in context.messages where message.role != .system {
            messages.append([
                "role": message.role == .assistant ? "assistant" : "user",
                "content": message.content
            ])
        }

        var body: [String: Any] = [
            "max_tokens": context.maxTokens,
            "messages": messages
        ]
        if !context.model.isEmpty { body["model"] = context.model }

        var headers = ["content-type": "application/json"]
        // A present `apiKey` (even empty) means the template ships an apiKey field, so
        // a key is expected — fail fast if it's blank rather than firing an
        // unauthenticated request that just 401s. Keyless templates (Ollama) omit the
        // apiKey field entirely, so `apiKey` is nil and no Authorization is sent.
        if let apiKey = context.config.apiKey {
            guard !apiKey.isEmpty else { throw PluginError.missingAPIKey }
            headers["Authorization"] = "Bearer \(apiKey)"
        }

        return .http(
            method: .post,
            url: url,
            headers: headers,
            body: try JSONSerialization.data(withJSONObject: body)
        )
    }

    /// Whether the base URL's last path segment looks like an API version (e.g.
    /// "v1", "v1beta") — a `v` followed by a digit — so the caller knows not to
    /// append its own version segment.
    static func isVersioned(_ baseURL: String) -> Bool {
        let trimmed = baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL
        guard let last = trimmed.split(separator: "/").last, last.first == "v" else { return false }
        return last.dropFirst().first?.isNumber == true
    }

    public func makeDecoder() -> any AIStreamDecoder { ChatReplyDecoder() }

    public func describeError(status: Int, body: Data) -> String? {
        ChatReplyDecoder.parseErrorMessage(from: body)
    }

    enum PluginError: Error, LocalizedError {
        case missingAPIKey
        case missingBaseURL
        case invalidURL

        var errorDescription: String? {
            switch self {
            case .missingAPIKey: return "An API key is required."
            case .missingBaseURL: return "A base URL is required for custom endpoints."
            case .invalidURL: return "The base URL is invalid."
            }
        }
    }
}

/// Buffers a full Chat Completions JSON response and emits the reply on `finish()`.
final class ChatReplyDecoder: AIStreamDecoder {

    private var buffer = Data()

    func consume(_ data: Data) -> [AIStreamEvent] {
        buffer.append(data)
        return []
    }

    func finish() -> [AIStreamEvent] {
        [.textDelta(Self.parseReply(from: buffer)), .end(stopReason: nil)]
    }

    static func parseReply(from data: Data) -> String {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let first = choices.first,
              let message = first["message"] as? [String: Any],
              let content = message["content"] as? String else {
            return "(Unable to parse response)"
        }
        return content
    }

    static func parseErrorMessage(from data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let error = json["error"] as? [String: Any], let message = error["message"] as? String {
            return message
        }
        return json["message"] as? String
    }
}

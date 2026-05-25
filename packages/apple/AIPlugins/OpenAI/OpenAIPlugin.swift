import Foundation
import AIPluginKit

/// LLM plugin for the OpenAI Chat Completions API.
///
/// Foundation-only: it describes the HTTP request and decodes the JSON reply.
/// The host owns transport, settings UI, and the API key.
public final class OpenAIPlugin: NSObject, AIPlugin, @unchecked Sendable {

    public override init() { super.init() }

    public func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
        guard let apiKey = context.config.apiKey, !apiKey.isEmpty else {
            throw PluginError.missingAPIKey
        }
        let model = context.model.isEmpty ? "gpt-4.1-nano" : context.model
        return try OpenAIChatRequest.make(
            baseURL: "https://api.openai.com",
            apiKey: apiKey,
            model: model,
            context: context
        )
    }

    public func makeDecoder() -> any AIStreamDecoder { OpenAIReplyDecoder() }

    public func describeError(status: Int, body: Data) -> String? {
        OpenAIReplyDecoder.parseErrorMessage(from: body)
    }

    enum PluginError: Error, LocalizedError {
        case missingAPIKey

        var errorDescription: String? {
            switch self {
            case .missingAPIKey: return "An OpenAI API key is required."
            }
        }
    }
}

/// Builds an OpenAI Chat Completions request body shared by the OpenAI and
/// OpenAI-compatible plugins' request shapes.
enum OpenAIChatRequest {

    static func make(
        baseURL: String,
        apiKey: String,
        model: String,
        context: AIChatContext
    ) throws -> AIRequestSpec {
        guard let url = URL(string: baseURL)?.appendingPathComponent("v1/chat/completions") else {
            throw RequestError.invalidURL
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
        if !model.isEmpty { body["model"] = model }

        return .http(
            method: .post,
            url: url,
            headers: [
                "Authorization": "Bearer \(apiKey)",
                "content-type": "application/json"
            ],
            body: try JSONSerialization.data(withJSONObject: body)
        )
    }

    enum RequestError: Error, LocalizedError {
        case invalidURL

        var errorDescription: String? {
            switch self {
            case .invalidURL: return "The endpoint URL is invalid."
            }
        }
    }
}

/// Buffers a full OpenAI Chat Completions JSON response, then emits the assistant
/// reply as a single text event. OpenAI's non-streaming responses arrive as one
/// JSON object, so the decoder accumulates everything and parses on `finish()`.
final class OpenAIReplyDecoder: AIStreamDecoder {

    private var buffer = Data()

    func consume(_ data: Data) -> [AIStreamEvent] {
        buffer.append(data)
        return []
    }

    func finish() -> [AIStreamEvent] {
        let reply = Self.parseReply(from: buffer)
        return [.textDelta(reply), .end(stopReason: nil)]
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

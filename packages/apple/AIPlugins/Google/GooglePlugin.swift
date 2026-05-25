import Foundation
import AIPluginKit

/// LLM plugin for the Google Gemini `generateContent` API.
///
/// Foundation-only: describes the HTTP request and decodes the JSON reply. The
/// host owns transport, settings UI, and the API key.
public final class GooglePlugin: NSObject, AIPlugin, @unchecked Sendable {

    public override init() { super.init() }

    public func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
        guard let apiKey = context.config.apiKey, !apiKey.isEmpty else {
            throw PluginError.missingAPIKey
        }
        let model = context.model.isEmpty ? "gemini-2.0-flash" : context.model

        var components = URLComponents()
        components.scheme = "https"
        components.host = "generativelanguage.googleapis.com"
        components.path = "/v1beta/models/\(model):generateContent"
        components.queryItems = [URLQueryItem(name: "key", value: apiKey)]
        guard let url = components.url else { throw PluginError.invalidURL }

        let contents = context.messages
            .filter { $0.role != .system }
            .map { message -> [String: Any] in
                [
                    "role": message.role == .assistant ? "model" : "user",
                    "parts": [["text": message.content]]
                ]
            }

        var body: [String: Any] = [
            "contents": contents,
            "generationConfig": ["maxOutputTokens": context.maxTokens]
        ]
        if let systemPrompt = context.systemPrompt, !systemPrompt.isEmpty {
            body["systemInstruction"] = ["parts": [["text": systemPrompt]]]
        }

        return .http(
            method: .post,
            url: url,
            headers: ["content-type": "application/json"],
            body: try JSONSerialization.data(withJSONObject: body)
        )
    }

    public func makeDecoder() -> any AIStreamDecoder { GeminiReplyDecoder() }

    public func describeError(status: Int, body: Data) -> String? {
        GeminiReplyDecoder.parseErrorMessage(from: body)
    }

    enum PluginError: Error, LocalizedError {
        case missingAPIKey
        case invalidURL

        var errorDescription: String? {
            switch self {
            case .missingAPIKey: return "A Google API key is required."
            case .invalidURL: return "The Gemini API URL is invalid."
            }
        }
    }
}

/// Buffers a full Gemini `generateContent` JSON response and emits the reply on
/// `finish()`.
final class GeminiReplyDecoder: AIStreamDecoder {

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
              let candidates = json["candidates"] as? [[String: Any]],
              let first = candidates.first,
              let content = first["content"] as? [String: Any],
              let parts = content["parts"] as? [[String: Any]],
              let firstPart = parts.first,
              let text = firstPart["text"] as? String else {
            return "(Unable to parse response)"
        }
        return text
    }

    static func parseErrorMessage(from data: Data) -> String? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let error = json["error"] as? [String: Any],
              let message = error["message"] as? String else {
            return nil
        }
        return message
    }
}

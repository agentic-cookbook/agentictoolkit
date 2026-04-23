import Foundation

/// Shared parsers for OpenAI Chat Completions–shaped responses.
/// Used by both the official OpenAI plugin and the OpenAI-compatible plugin
/// (LM Studio, self-hosted, etc.), so it lives in the SDK to avoid cross-plugin
/// linkage.
public enum OpenAIResponseParser {

    public static func parseReply(from data: Data) -> String {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let first = choices.first,
              let message = first["message"] as? [String: Any],
              let content = message["content"] as? String else {
            return "(Unable to parse response)"
        }
        return content
    }

    public static func parseErrorMessage(from body: String) -> String? {
        guard let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let error = json["error"] as? [String: Any], let message = error["message"] as? String {
            return message
        }
        if let message = json["message"] as? String {
            return message
        }
        return nil
    }
}

import Foundation

/// Best-effort lookup of the models an OpenAI-compatible endpoint actually
/// serves, via its `GET {baseURL}/models` route (the same shape Ollama, LM
/// Studio, Groq, OpenAI, … expose). Used to populate the model picker with what
/// is really installed/available rather than a hard-coded template list.
///
/// Every failure — no base URL, unreachable host, non-2xx, unparseable body —
/// resolves to an empty list so callers can silently fall back to their static
/// models.
public enum OpenAIModelCatalog {

    /// Fetches the available model ids. Returns `[]` on any failure.
    public static func fetch(baseURL: String, apiKey: String?, timeout: TimeInterval = 8) async -> [String] {
        let trimmed = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let url = URL(string: trimmed)?.appendingPathComponent("models") else {
            return []
        }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        if let apiKey, !apiKey.isEmpty {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse,
              (200..<300).contains(http.statusCode) else {
            return []
        }
        return parse(data)
    }

    /// Extracts model ids from an OpenAI `/models` payload (`{ "data": [{ "id": … }] }`).
    /// Pure and side-effect free so it can be unit-tested without a network.
    static func parse(_ data: Data) -> [String] {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let entries = json["data"] as? [[String: Any]] else {
            return []
        }
        return entries.compactMap { $0["id"] as? String }
    }
}

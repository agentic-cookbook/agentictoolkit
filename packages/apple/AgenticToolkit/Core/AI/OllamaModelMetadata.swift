import Foundation

/// The subset of Ollama's `POST /api/show` response the model chooser surfaces:
/// what a locally-pulled model can do and how big it is. Ollama alone can report
/// this (adh's catalog and the OpenAI `/v1/models` route carry only ids), so it's
/// discovered live per model.
public struct OllamaModelMetadata: Codable, Equatable, Sendable {
    /// e.g. `["completion", "tools", "insert", "vision"]`.
    public let capabilities: [String]
    /// e.g. `"32.8B"`.
    public let parameterSize: String?
    /// e.g. `"Q4_K_M"`.
    public let quantization: String?
    /// The model's context window, when reported.
    public let contextLength: Int?

    public init(capabilities: [String], parameterSize: String?, quantization: String?, contextLength: Int?) {
        self.capabilities = capabilities
        self.parameterSize = parameterSize
        self.quantization = quantization
        self.contextLength = contextLength
    }

    public var supportsTools: Bool { capabilities.contains("tools") }
    public var supportsVision: Bool { capabilities.contains("vision") }
}

/// Live per-model metadata from a local Ollama server's **native** API
/// (`/api/show`) — distinct from the OpenAI-compatible `/v1` base URL a provider
/// is configured with. Every failure degrades to `nil` so the caller falls back
/// to curated data (or none). Only meaningful for loopback base URLs.
public enum LocalModelMetadataStore {

    private static let loopbackHosts: Set<String> = [
        "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"
    ]

    /// True when `baseURL` points at this machine (a local model server).
    public static func isLoopback(baseURL: String) -> Bool {
        guard let host = URL(string: baseURL)?.host?.lowercased() else { return false }
        return loopbackHosts.contains(host)
    }

    /// Ollama's native API sits at the server root; drop a trailing `/v1` (and any
    /// slashes) from the OpenAI-compatible base URL to reach it.
    public static func nativeOllamaBase(fromOpenAIBase baseURL: String) -> String {
        var result = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        while result.hasSuffix("/") { result.removeLast() }
        if result.hasSuffix("/v1") { result.removeLast(3) }
        while result.hasSuffix("/") { result.removeLast() }
        return result
    }

    /// Parse the fields we use out of an `/api/show` body. Pure; nil when the body
    /// is unparseable or carries nothing useful.
    public static func parseShow(_ data: Data) -> OllamaModelMetadata? {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        let capabilities = (json["capabilities"] as? [String]) ?? []
        let details = json["details"] as? [String: Any]
        let parameterSize = details?["parameter_size"] as? String
        let quantization = details?["quantization_level"] as? String
        var contextLength: Int?
        if let info = json["model_info"] as? [String: Any] {
            for (key, value) in info where key.hasSuffix(".context_length") {
                if let intValue = value as? Int { contextLength = intValue; break }
                if let doubleValue = value as? Double { contextLength = Int(doubleValue); break }
            }
        }
        if capabilities.isEmpty, parameterSize == nil, quantization == nil, contextLength == nil {
            return nil
        }
        return OllamaModelMetadata(
            capabilities: capabilities, parameterSize: parameterSize,
            quantization: quantization, contextLength: contextLength)
    }

    /// `POST {nativeBase}/api/show {"model": …}` and parse it; `nil` on any failure.
    public static func fetch(
        openAIBaseURL: String, model: String, timeout: TimeInterval = 5
    ) async -> OllamaModelMetadata? {
        let base = nativeOllamaBase(fromOpenAIBase: openAIBaseURL)
        guard !base.isEmpty, let url = URL(string: base + "/api/show"),
              let body = try? JSONSerialization.data(withJSONObject: ["model": model]) else { return nil }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
        return parseShow(data)
    }
}

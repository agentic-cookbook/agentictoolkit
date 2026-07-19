import Foundation

/// Knowledge about local (loopback) OpenAI-compatible model servers — shared by the
/// inference guard and hosts' model pickers so loopback detection, the native-API
/// URL derivation, and `/api/tags` size parsing cannot drift.
public enum LocalModelServer {

    private static let loopbackHosts: Set<String> = [
        "localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"
    ]

    /// True when `baseURL` points at this machine, i.e. a local model server.
    public static func isLoopback(baseURL: String) -> Bool {
        guard let host = URL(string: baseURL)?.host?.lowercased() else { return false }
        return loopbackHosts.contains(host)
    }

    /// Ollama's native tags endpoint for an OpenAI-compat base URL:
    /// `http://localhost:11434/v1` → `http://localhost:11434/api/tags`. The native
    /// API is the only listing that reports model sizes.
    public static func nativeTagsURL(baseURL: String) -> URL? {
        var trimmed = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        while trimmed.hasSuffix("/") { trimmed = String(trimmed.dropLast()) }
        if trimmed.lowercased().hasSuffix("/v1") { trimmed = String(trimmed.dropLast(3)) }
        while trimmed.hasSuffix("/") { trimmed = String(trimmed.dropLast()) }
        guard !trimmed.isEmpty else { return nil }
        return URL(string: trimmed + "/api/tags")
    }

    /// Parses `/api/tags` JSON (`{"models":[{"name":…,"model":…,"size":…}]}`) into
    /// `model id → size bytes`. Both `name` and the newer `model` key index the same
    /// entry so lookups succeed whichever form a config stored. [:] on undecodable
    /// input.
    public static func parseSizes(_ data: Data) -> [String: Int] {
        struct Tags: Decodable {
            struct Model: Decodable {
                let name: String?
                let model: String?
                let size: Int?
            }
            let models: [Model]
        }
        guard let tags = try? JSONDecoder().decode(Tags.self, from: data) else { return [:] }
        var sizes: [String: Int] = [:]
        for entry in tags.models {
            guard let size = entry.size else { continue }
            if let name = entry.name { sizes[name] = size }
            if let model = entry.model { sizes[model] = size }
        }
        return sizes
    }

    /// The stored size for `model`, tolerating the `:latest` shorthand.
    public static func size(of model: String, in sizes: [String: Int]) -> Int? {
        sizes[model] ?? sizes[model + ":latest"]
    }
}

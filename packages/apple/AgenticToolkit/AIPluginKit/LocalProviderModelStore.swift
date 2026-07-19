import Foundation
import AgenticToolkitCore

/// Live model discovery for **local** (loopback) OpenAI-compatible providers such as
/// Ollama. A local server's installed models are known only to the server — a fixed
/// remote catalog can't know what the user pulled, and pinning one silently hides the
/// real selection. So for loopback base URLs the Model popup is sourced from the live
/// server, with the last successful fetch cached per base URL: the cache paints the
/// list instantly and keeps working when the server is down, while every rebuild
/// re-fetches to pick up newly pulled or removed models.
///
/// Remote providers are unaffected — they keep their descriptor catalog (adh knows a
/// hosted provider's models; it can't know a local one's).
@MainActor
public enum LocalProviderModelStore {

    /// baseURL string -> last successfully fetched model ids.
    private static let cache = UserSetting<[String: [String]]>(
        "aiplugin.localModelCache", default: [:])

    /// baseURL string -> model id -> size bytes (from ollama's native /api/tags).
    private static let sizeCache = UserSetting<[String: [String: Int]]>(
        "aiplugin.localModelSizeCache", default: [:])

    /// True when `baseURL` points at this machine, i.e. a local model server.
    public static func isLocal(baseURL: String) -> Bool {
        LocalModelServer.isLoopback(baseURL: baseURL)
    }

    /// The last models fetched for `baseURL`, or empty if none cached yet.
    public static func cachedModels(baseURL: String) -> [String] {
        cache.value[baseURL] ?? []
    }

    /// The last sizes fetched for `baseURL`, or empty if none cached yet.
    public static func cachedSizes(baseURL: String) -> [String: Int] {
        sizeCache.value[baseURL] ?? [:]
    }

    /// `GET {baseURL}/models` (the OpenAI-compatible listing Ollama also serves),
    /// returning the model ids and caching them on success. Returns `nil` on any
    /// failure — a bad URL, transport error, non-200, undecodable body, or empty
    /// list — so the caller keeps showing the cached list instead of blanking it.
    public static func fetchModels(baseURL: String) async -> [String]? {
        let trimmed = baseURL.hasSuffix("/") ? String(baseURL.dropLast()) : baseURL
        guard let url = URL(string: trimmed + "/models") else { return nil }
        var request = URLRequest(url: url, timeoutInterval: 5)
        request.httpMethod = "GET"
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                  let ids = try? JSONDecoder().decode(OpenAIModelList.self, from: data).data.map(\.id),
                  !ids.isEmpty else {
                return nil
            }
            var dict = cache.value
            dict[baseURL] = ids
            cache.value = dict
            return ids
        } catch {
            return nil
        }
    }

    /// `GET {origin}/api/tags` — ollama's native listing, the only one that carries
    /// per-model sizes — cached per base URL like the ids. Returns nil on any
    /// failure (non-ollama local servers simply render without sizes/badges).
    public static func fetchSizes(baseURL: String) async -> [String: Int]? {
        guard let url = LocalModelServer.nativeTagsURL(baseURL: baseURL) else { return nil }
        var request = URLRequest(url: url, timeoutInterval: 5)
        request.httpMethod = "GET"
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
            let sizes = LocalModelServer.parseSizes(data)
            guard !sizes.isEmpty else { return nil }
            var dict = sizeCache.value
            dict[baseURL] = sizes
            sizeCache.value = dict
            return sizes
        } catch {
            return nil
        }
    }

    /// The OpenAI `/v1/models` response shape (`{ "data": [ { "id": … } ] }`).
    private struct OpenAIModelList: Decodable {
        struct Model: Decodable { let id: String }
        let data: [Model]
    }
}

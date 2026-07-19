import Foundation

/// Fetches and caches a local server's `model → size bytes` map from ollama's
/// native `/api/tags` (the only listing that carries sizes). Success is cached for
/// `successTTL`; failure — server down, or a non-ollama local server with no
/// `/api/tags` — for `failureTTL`, so a down server isn't hammered on every
/// completion. nil means "unknown": the guard fails open on the size check.
public actor LocalModelCatalog {
    public static let shared = LocalModelCatalog()

    public typealias Fetcher = @Sendable (URL) async throws -> Data

    public static let liveFetcher: Fetcher = { url in
        var request = URLRequest(url: url, timeoutInterval: 5)
        request.httpMethod = "GET"
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return data
    }

    private struct Entry {
        let sizes: [String: Int]?  // nil = the fetch failed (sizes unknown)
        let fetchedAt: Date
    }

    private let fetcher: Fetcher
    private let successTTL: TimeInterval
    private let failureTTL: TimeInterval
    private var cache: [String: Entry] = [:]  // keyed by baseURL

    public init(
        fetcher: @escaping Fetcher = liveFetcher,
        successTTL: TimeInterval = 300,
        failureTTL: TimeInterval = 60
    ) {
        self.fetcher = fetcher
        self.successTTL = successTTL
        self.failureTTL = failureTTL
    }

    /// The on-disk size of `model` at the server behind `baseURL`, or nil when
    /// unknown (unreachable server, non-ollama server, model not listed).
    public func sizeBytes(model: String, baseURL: String) async -> Int? {
        guard let sizes = await sizes(baseURL: baseURL) else { return nil }
        return LocalModelServer.size(of: model, in: sizes)
    }

    private func sizes(baseURL: String) async -> [String: Int]? {
        if let entry = cache[baseURL] {
            let ttl = entry.sizes == nil ? failureTTL : successTTL
            if Date().timeIntervalSince(entry.fetchedAt) < ttl { return entry.sizes }
        }
        guard let url = LocalModelServer.nativeTagsURL(baseURL: baseURL) else { return nil }
        let sizes: [String: Int]?
        if let data = try? await fetcher(url) {
            let parsed = LocalModelServer.parseSizes(data)
            sizes = parsed.isEmpty ? nil : parsed
        } else {
            sizes = nil
        }
        cache[baseURL] = Entry(sizes: sizes, fetchedAt: Date())
        return sizes
    }
}

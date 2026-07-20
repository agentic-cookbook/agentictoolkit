import Foundation

/// Prose descriptions for mainstream models from the public hosted-model
/// catalogs: OpenRouter's `/api/v1/models` (~340 models, rich paragraphs) and
/// models.dev's `api.json` (~2,800 ids across 167 providers, terse one-liners).
/// Neither knows community fine-tunes — those only exist on ollama.com — so
/// matching is deliberately conservative (prefix-anchored on the model's base
/// name): an "uncensored" fine-tune must never inherit its base model's blurb.
/// Parsing and matching are pure for testability; fetches degrade to empty.
@MainActor
public enum ModelCatalogStore {

    /// Both catalogs from one fetch round; a side is empty when its fetch failed.
    public struct Catalog: Sendable {
        public let openRouter: [String: String]
        public let modelsDev: [String: String]
        public init(openRouter: [String: String], modelsDev: [String: String]) {
            self.openRouter = openRouter
            self.modelsDev = modelsDev
        }
        public var isEmpty: Bool { openRouter.isEmpty && modelsDev.isEmpty }
    }

    private static var cached: Catalog?
    private static var fetchedAt: Date?
    private static var inflight: Task<Catalog, Never>?
    private static let ttl: TimeInterval = 15 * 60

    /// The best catalog description for `model` — OpenRouter first (richer
    /// prose), then models.dev — or nil when neither has a confident match.
    public static func description(for model: String) async -> String? {
        let catalog = await self.catalog()
        return bestMatch(for: model, in: catalog.openRouter)
            ?? bestMatch(for: model, in: catalog.modelsDev)
    }

    /// The catalogs, fetched concurrently at most once per TTL per app run and
    /// single-flighted, so a chooser refreshing N models triggers one round of
    /// fetches, not N. A failed round returns the previous good catalog (stale
    /// beats empty) without caching the failure.
    public static func catalog() async -> Catalog {
        if let cached, let fetchedAt, Date().timeIntervalSince(fetchedAt) < ttl { return cached }
        if let inflight { return await inflight.value }
        let task = Task { () -> Catalog in
            async let openRouter = fetchData("https://openrouter.ai/api/v1/models")
            async let modelsDev = fetchData("https://models.dev/api.json")
            return Catalog(openRouter: (await openRouter).map(parseOpenRouter) ?? [:],
                           modelsDev: (await modelsDev).map(parseModelsDev) ?? [:])
        }
        inflight = task
        let result = await task.value
        inflight = nil
        if !result.isEmpty {
            cached = result
            fetchedAt = Date()
        }
        if result.isEmpty, let cached { return cached }
        return result
    }

    /// True when `text` is a real blurb rather than a token like a bare URL or
    /// a word — the bar a fetched description must clear before it blocks the
    /// catalog fallback (ollama.com community pages sometimes carry blurbs as
    /// thin as "www.example.ai").
    nonisolated public static func isSubstantial(_ text: String) -> Bool {
        text.count >= 40 && text.contains(" ")
    }

    /// OpenRouter's `{"data":[{"id":…,"description":…}]}` → id → description.
    nonisolated public static func parseOpenRouter(_ data: Data) -> [String: String] {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let models = root["data"] as? [[String: Any]] else { return [:] }
        var result: [String: String] = [:]
        for model in models {
            guard let id = model["id"] as? String,
                  let description = model["description"] as? String, !description.isEmpty else {
                continue
            }
            result[id] = description
        }
        return result
    }

    /// models.dev's `{provider: {models: {id: {description:…}}}}` → id →
    /// description; the first provider to describe an id wins deterministically
    /// (providers in sorted order) since duplicates describe the same model.
    nonisolated public static func parseModelsDev(_ data: Data) -> [String: String] {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        var result: [String: String] = [:]
        for provider in root.keys.sorted() {
            guard let models = (root[provider] as? [String: Any])?["models"] as? [String: Any] else {
                continue
            }
            for (id, value) in models {
                guard result[id] == nil,
                      let description = (value as? [String: Any])?["description"] as? String,
                      !description.isEmpty else { continue }
                result[id] = description
            }
        }
        return result
    }

    /// The description whose catalog id best matches `model` (an ollama-style
    /// `namespace/name:tag` or a bare provider id). Matching: drop the
    /// namespace and tag, normalize to lowercase alphanumerics, then require a
    /// catalog id's last path segment to START with the base name — exact
    /// beats prefix; a size tag on the model ("…:16b") restricts to same-sized
    /// candidates, else size-less (family-level) ones, never a different size;
    /// then the shortest id (fewest extra qualifiers) wins. A bare "-latest"
    /// suffix on the id itself is retried stripped ("grok-2-latest").
    nonisolated public static func bestMatch(for model: String, in catalog: [String: String]) -> String? {
        let name = model.split(separator: "/").last.map(String.init) ?? model
        let parts = name.split(separator: ":", maxSplits: 1).map(String.init)
        let base = normalize(parts.first ?? "")
        guard !base.isEmpty else { return nil }
        let size = parts.count > 1 ? sizeTokens(inRawSegment: parts[1]).sorted().first : nil
        if let match = match(base, size: size, in: catalog) { return match }
        if base.hasSuffix("latest"), base != "latest" {
            return match(String(base.dropLast("latest".count)), size: size, in: catalog)
        }
        return nil
    }

    nonisolated private static func match(
        _ base: String, size: String?, in catalog: [String: String]
    ) -> String? {
        var candidates: [(key: String, norm: String, sizes: Set<String>)] = []
        for key in catalog.keys {
            let segment = key.split(separator: "/").last.map(String.init) ?? key
            let last = normalize(segment)
            if last == base { return catalog[key] }
            if last.hasPrefix(base) {
                candidates.append((key, last, sizeTokens(inRawSegment: segment)))
            }
        }
        if let size {
            let sized = candidates.filter { $0.sizes.contains(size) }
            candidates = sized.isEmpty ? candidates.filter { $0.sizes.isEmpty } : sized
        }
        let best = candidates.min { ($0.norm.count, $0.key) < ($1.norm.count, $1.key) }
        return best.flatMap { catalog[$0.key] }
    }

    nonisolated private static func normalize(_ text: String) -> String {
        text.lowercased().filter { $0.isASCII && ($0.isLetter || $0.isNumber) }
    }

    /// The parameter-size tokens in a raw (pre-normalization) id segment or tag,
    /// as normalized strings — "llama-3.1-8b-instruct" → {"8b"}, "1.5b" →
    /// {"15b"}, "mixtral-8x7b" → {} (composite, not a plain size). Extracted
    /// BEFORE separators are stripped: normalization merges version digits into
    /// size digits ("llama-3.1-8b" → "llama318b"), making sizes unrecoverable.
    nonisolated private static func sizeTokens(inRawSegment segment: String) -> Set<String> {
        var result: Set<String> = []
        let tokens = segment.lowercased().split {
            !$0.isASCII || (!$0.isLetter && !$0.isNumber && $0 != ".")
        }
        for token in tokens where token.hasSuffix("b") {
            let digits = token.dropLast()
            guard !digits.isEmpty, digits.first != ".", digits.last != ".",
                  digits.allSatisfy({ $0.isNumber || $0 == "." }),
                  digits.filter({ $0 == "." }).count <= 1 else { continue }
            result.insert(String(token).replacingOccurrences(of: ".", with: ""))
        }
        return result
    }

    nonisolated private static func fetchData(
        _ urlString: String, timeout: TimeInterval = 10
    ) async -> Data? {
        guard let url = URL(string: urlString) else { return nil }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = "GET"
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
        return data
    }
}

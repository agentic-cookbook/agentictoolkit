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

    /// All three catalogs. As returned by `catalog()` a failed side carries its
    /// previous good data (per-side fallback), so a side is empty only when
    /// it has never fetched successfully.
    public struct Catalog: Sendable {
        public let openRouter: [String: String]
        public let modelsDev: [String: String]
        public let adh: [String: String]
        public init(
            openRouter: [String: String],
            modelsDev: [String: String],
            adh: [String: String]
        ) {
            self.openRouter = openRouter
            self.modelsDev = modelsDev
            self.adh = adh
        }
        public var isEmpty: Bool { openRouter.isEmpty && modelsDev.isEmpty && adh.isEmpty }
    }

    private static var lastGood: Catalog?
    private static var inflight: Task<Catalog, Never>?

    /// The best catalog description for `model` — adh first (operator-authored
    /// curated prose, authoritative where present), then OpenRouter (richer
    /// third-party prose), then models.dev — or nil when none has a confident
    /// match.
    public static func description(for model: String) async -> String? {
        let catalog = await self.catalog()
        return bestMatch(for: model, in: catalog.adh)
            ?? bestMatch(for: model, in: catalog.openRouter)
            ?? bestMatch(for: model, in: catalog.modelsDev)
    }

    /// The adh provider-catalog endpoint (spec: provider-catalog-sync). The adh
    /// catalog is the PRIMARY source: its curated descriptions are operator-
    /// authored; OpenRouter/models.dev remain the fallback pair.
    public static var adhCatalogURL =
        "https://api.agenticdeveloperhub.com/persona/provider-templates?pageSize=100"

    /// The catalogs, fetched concurrently — ALWAYS a live round, never a timed
    /// cache: an open round is joined (so a chooser refreshing N models at once
    /// triggers one round, not N), and the next burst fetches fresh. Each side
    /// that fails falls back to its own previous good data independently
    /// (stale beats empty, per catalog), and the merge happens inside the
    /// shared task so starter and joiners alike see the merged result.
    public static func catalog() async -> Catalog {
        if let inflight { return await inflight.value }
        let task = Task { () -> Catalog in
            async let openRouter = fetchData("https://openrouter.ai/api/v1/models")
            async let modelsDev = fetchData("https://models.dev/api.json")
            async let adh = fetchData(adhCatalogURL)
            let fresh = Catalog(openRouter: (await openRouter).map(parseOpenRouter) ?? [:],
                                modelsDev: (await modelsDev).map(parseModelsDev) ?? [:],
                                adh: (await adh).map(parseAdhCatalog) ?? [:])
            let result = merged(fresh, lastGood: lastGood)
            if !result.isEmpty { lastGood = result }
            return result
        }
        inflight = task
        let result = await task.value
        inflight = nil
        return result
    }

    /// `fresh` with each empty (failed) side replaced by that side's last good
    /// data — one catalog timing out must never blank the other's fallback nor
    /// poison `lastGood` with a half-empty round.
    nonisolated public static func merged(_ fresh: Catalog, lastGood: Catalog?) -> Catalog {
        guard let lastGood else { return fresh }
        return Catalog(
            openRouter: fresh.openRouter.isEmpty ? lastGood.openRouter : fresh.openRouter,
            modelsDev: fresh.modelsDev.isEmpty ? lastGood.modelsDev : fresh.modelsDev,
            adh: fresh.adh.isEmpty ? lastGood.adh : fresh.adh)
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

    /// adh's `{"items":[{"models":[{"name":…,"description":…}]}]}` → name → description.
    nonisolated public static func parseAdhCatalog(_ data: Data) -> [String: String] {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let items = root["items"] as? [[String: Any]] else { return [:] }
        var result: [String: String] = [:]
        for template in items {
            guard let models = template["models"] as? [[String: Any]] else { continue }
            for model in models {
                guard let name = model["name"] as? String,
                      let description = model["description"] as? String, !description.isEmpty,
                      result[name] == nil else { continue }
                result[name] = description
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
        bestMatchKey(for: model, in: Array(catalog.keys)).flatMap { catalog[$0] }
    }

    /// `bestMatch` over bare ids: the catalog KEY that best matches `model`,
    /// for callers whose values aren't strings (e.g. rank records keyed by slug).
    nonisolated public static func bestMatchKey(for model: String, in keys: [String]) -> String? {
        let name = model.split(separator: "/").last.map(String.init) ?? model
        let parts = name.split(separator: ":", maxSplits: 1).map(String.init)
        let base = normalize(parts.first ?? "")
        guard !base.isEmpty else { return nil }
        let size = parts.count > 1 ? sizeTokens(inRawSegment: parts[1]).sorted().first : nil
        if let key = matchKey(base, size: size, in: keys) { return key }
        if base.hasSuffix("latest"), base != "latest" {
            return matchKey(String(base.dropLast("latest".count)), size: size, in: keys)
        }
        return nil
    }

    nonisolated private static func matchKey(
        _ base: String, size: String?, in keys: [String]
    ) -> String? {
        var candidates: [(key: String, norm: String, sizes: Set<String>)] = []
        for key in keys {
            let segment = key.split(separator: "/").last.map(String.init) ?? key
            let last = normalize(segment)
            if last == base { return key }
            if last.hasPrefix(base) {
                candidates.append((key, last, sizeTokens(inRawSegment: segment)))
            }
        }
        if let size {
            let sized = candidates.filter { $0.sizes.contains(size) }
            candidates = sized.isEmpty ? candidates.filter { $0.sizes.isEmpty } : sized
        }
        let best = candidates.min { ($0.norm.count, $0.key) < ($1.norm.count, $1.key) }
        return best?.key
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

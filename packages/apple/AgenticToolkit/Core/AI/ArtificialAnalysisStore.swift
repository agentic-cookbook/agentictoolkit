import Foundation

/// Model RANKINGS from Artificial Analysis (artificialanalysis.ai) — the one
/// mainstream leaderboard with a real API: `GET /api/v2/data/llms/models`
/// returns every benchmarked model's intelligence/coding indices and measured
/// speed. Requires a free API key (`x-api-key`, 1,000 requests/day), stored in
/// user defaults under `aiplugin.artificialAnalysisAPIKey`; without one every
/// call returns nil and the UI simply shows no rank line. Fetches are always a
/// live round (join-or-start, never a timed cache) with the last good result
/// as the failure fallback, and resolved ranks persist per model id so a
/// reopened chooser paints instantly before the live round lands.
@MainActor
public enum ArtificialAnalysisStore {

    /// One model's leaderboard entry. Indices are 0–100 scales; speed is
    /// median output tokens/second as measured by Artificial Analysis.
    public struct ModelRank: Codable, Sendable, Equatable {
        public let name: String
        public let intelligenceIndex: Double?
        public let codingIndex: Double?
        public let outputTokensPerSecond: Double?
        public init(name: String, intelligenceIndex: Double?,
                    codingIndex: Double?, outputTokensPerSecond: Double?) {
            self.name = name
            self.intelligenceIndex = intelligenceIndex
            self.codingIndex = codingIndex
            self.outputTokensPerSecond = outputTokensPerSecond
        }
    }

    private static let apiKey = UserSetting<String>(
        "aiplugin.artificialAnalysisAPIKey", default: "")

    /// model id (as the chooser asked for it) -> last resolved rank.
    private static let rankCache = UserSetting<[String: ModelRank]>(
        "aiplugin.artificialAnalysisRankCache", default: [:])

    private static var lastGood: [String: ModelRank]?
    private static var inflight: Task<[String: ModelRank], Never>?

    /// True when an API key is stored, i.e. rank lines can ever appear.
    public static var isConfigured: Bool { !apiKey.value.isEmpty }

    /// The last resolved ranks, or empty if none cached yet.
    public static func cachedRanks() -> [String: ModelRank] { rankCache.value }

    /// The live leaderboard entry best matching `model` (same conservative
    /// matching as the description catalogs), cached per model id on success;
    /// nil without an API key or a confident match.
    public static func rank(for model: String) async -> ModelRank? {
        guard isConfigured else { return nil }
        let ranks = await allRanks()
        guard let key = ModelCatalogStore.bestMatchKey(for: model, in: Array(ranks.keys)),
              let rank = ranks[key] else { return nil }
        var dict = rankCache.value
        dict[model] = rank
        rankCache.value = dict
        return rank
    }

    /// slug -> rank for the whole leaderboard, join-or-start like
    /// `ModelCatalogStore.catalog()`.
    private static func allRanks() async -> [String: ModelRank] {
        if let inflight { return await inflight.value }
        let key = apiKey.value
        let task = Task { () -> [String: ModelRank] in
            await fetchData(key: key).map(parse) ?? [:]
        }
        inflight = task
        let result = await task.value
        inflight = nil
        if !result.isEmpty { lastGood = result }
        if result.isEmpty, let lastGood { return lastGood }
        return result
    }

    /// `{"data":[{"slug":…,"name":…,"evaluations":{…},…}]}` → slug → rank.
    nonisolated public static func parse(_ data: Data) -> [String: ModelRank] {
        guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let models = root["data"] as? [[String: Any]] else { return [:] }
        var result: [String: ModelRank] = [:]
        for model in models {
            guard let slug = model["slug"] as? String, !slug.isEmpty else { continue }
            let evaluations = model["evaluations"] as? [String: Any] ?? [:]
            result[slug] = ModelRank(
                name: model["name"] as? String ?? slug,
                intelligenceIndex: evaluations["artificial_analysis_intelligence_index"] as? Double,
                codingIndex: evaluations["artificial_analysis_coding_index"] as? Double,
                outputTokensPerSecond: model["median_output_tokens_per_second"] as? Double)
        }
        return result
    }

    nonisolated private static func fetchData(
        key: String, timeout: TimeInterval = 10
    ) async -> Data? {
        guard let url = URL(string: "https://artificialanalysis.ai/api/v2/data/llms/models") else {
            return nil
        }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = "GET"
        request.setValue(key, forHTTPHeaderField: "x-api-key")
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200 else { return nil }
        return data
    }
}

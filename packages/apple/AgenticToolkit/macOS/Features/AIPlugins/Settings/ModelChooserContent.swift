import Foundation
import AgenticToolkitCore
import AIPluginKit

/// Pure helpers that turn a model + its (curated and/or live) metadata into the
/// strings the chooser renders. Kept separate from the view controller so the
/// list/badge/spec logic is unit-testable without AppKit.
public enum ModelChooserContent {

    /// Only OpenAI-shaped endpoints serve `GET {baseURL}/models`; gate live fetching
    /// on plugin identity (mirrors the retired `LLMProvidersView.supportsLiveModels`).
    public static func supportsLiveModels(pluginIdentifier: String) -> Bool {
        pluginIdentifier.hasSuffix(".openai-compatible") || pluginIdentifier.hasSuffix(".openai")
    }

    /// The listed models plus `current` when it isn't already present, so a
    /// since-retired stored selection stays visible/selectable.
    public static func offeredModels(listed: [String], current: String) -> [String] {
        guard !current.isEmpty, !listed.contains(current) else { return listed }
        return listed + [current]
    }

    /// "Only models that fit this Mac" — the on-disk sizes and the machine's RAM a
    /// fit verdict is computed from, using the same policy (and the same thresholds)
    /// the daemon's guard enforces, so the list can never offer a model the guard
    /// would then refuse.
    public struct FitFilter: Sendable, Equatable {
        public let sizes: [String: Int]
        public let physicalRAM: UInt64
        public let warnPct: Int
        public let blockPct: Int

        public init(sizes: [String: Int], physicalRAM: UInt64,
                    warnPct: Int = ModelFitPolicy.defaultWarnPct,
                    blockPct: Int = ModelFitPolicy.defaultBlockPct) {
            self.sizes = sizes
            self.physicalRAM = physicalRAM
            self.warnPct = warnPct
            self.blockPct = blockPct
        }

        /// Is `model` small enough to keep?
        ///
        /// Only the block tier is dropped — the tier at which the guard refuses to
        /// run the model at all. Warn-tier models are heavy but do run, and the
        /// details pane already labels them; and a model whose size is unknown (any
        /// local server that isn't Ollama) is kept, matching how the guard itself
        /// fails open on an unknown size.
        public func keeps(_ model: String) -> Bool {
            ModelFitPolicy.tier(diskBytes: LocalModelServer.size(of: model, in: sizes),
                                physicalRAM: physicalRAM,
                                warnPct: warnPct, blockPct: blockPct) != .block
        }
    }

    /// The chooser's list filter: the search field's substring, the "good for"
    /// facets, and the fits-this-Mac box. The three are independent — a model must
    /// survive all of them.
    ///
    /// `descriptions` carries the live blurbs fetched per model (ollama.com), which
    /// is where a local model's only prose comes from; without it every model on a
    /// local server would be facet-less.
    public static func filter(_ items: [ModelPickerItem], query: String,
                              uses: Set<ModelUseFacet> = [],
                              descriptions: [String: String] = [:],
                              fit: FitFilter? = nil) -> [ModelPickerItem] {
        let needle = query.trimmingCharacters(in: .whitespaces).lowercased()
        return items.filter { item in
            if !uses.isEmpty {
                let facets = ModelUseFacet.facets(for: item.info, extraText: descriptions[item.id])
                guard ModelUseFacet.matches(facets: facets, selected: uses) else { return false }
            }
            if let fit, !fit.keeps(item.id) { return false }
            return needle.isEmpty || item.matches(needle)
        }
    }

    /// Capability badges — prefer the live server list (title-cased), else what the
    /// shared catalog reports, else `["Tools"]` from a curated `tools == true`.
    public static func capabilityBadges(item: ModelPickerItem, metadata: OllamaModelMetadata?) -> [String] {
        if let metadata, !metadata.capabilities.isEmpty {
            return metadata.capabilities
                .filter { $0 != "completion" }
                .map(titleCased)
        }
        return capabilityBadges(item.info)
    }

    /// Capability badges for a resolved model, with no live server to ask —
    /// the provider picker's per-model lines and the chooser's fallback.
    public static func capabilityBadges(_ info: AIModelCatalog.ResolvedModel) -> [String] {
        if !info.capabilities.isEmpty { return info.capabilities.map(titleCased) }
        return info.tools == true ? ["Tools"] : []
    }

    /// "131K context · 65K max output · $0.15/$0.60 per M tokens" — the numbers
    /// this provider serves the model under. `nil` when none are known.
    ///
    /// Deliberately excludes capabilities: those are the model's own and render as
    /// badges, while these differ per gateway (the same model is 262K tokens at one
    /// and 1M at another), which is why the catalog keys them by template.
    public static func factsLine(_ info: AIModelCatalog.ResolvedModel) -> String? {
        var parts: [String] = []
        if let context = info.contextWindow { parts.append("\(compact(context)) context") }
        if let output = info.maxOutput { parts.append("\(compact(output)) max output") }
        if let price = priceText(input: info.inputCostPerM, output: info.outputCostPerM) {
            parts.append(price)
        }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    private static func titleCased(_ word: some StringProtocol) -> String {
        word.prefix(1).uppercased() + word.dropFirst()
    }

    /// Token counts as everyone quotes them: 131072 -> "128K", 200000 -> "200K",
    /// 1048576 and 1000000 -> "1M".
    ///
    /// Which unit to divide by is the whole trick — a binary limit divided by 1000
    /// reads as the wrong number ("131K context" for what the vendor calls 128K),
    /// and a decimal limit divided by 1024 reads as "195K" for 200000. A limit that
    /// is an exact multiple of 1024 was set in binary; anything else was set in
    /// decimal.
    private static func compact(_ value: Int) -> String {
        let unit = value % 1024 == 0 ? 1024.0 : 1000.0
        if Double(value) >= unit * unit { return "\(Int((Double(value) / (unit * unit)).rounded()))M" }
        if Double(value) >= unit { return "\(Int((Double(value) / unit).rounded()))K" }
        return "\(value)"
    }

    /// Prices are per million tokens, input first. A provider that publishes only
    /// one of the two says which one it is rather than implying both.
    private static func priceText(input: Double?, output: Double?) -> String? {
        switch (input, output) {
        case let (input?, output?): return "$\(money(input))/$\(money(output)) per M tokens"
        case let (input?, nil): return "$\(money(input)) per M input tokens"
        case let (nil, output?): return "$\(money(output)) per M output tokens"
        default: return nil
        }
    }

    /// Three decimals, trailing zeros trimmed — $0.435 keeps its precision and
    /// $1.00 reads as "$1".
    private static func money(_ value: Double) -> String {
        var text = String(format: "%.3f", value)
        if text.contains(".") {
            while text.hasSuffix("0") { text.removeLast() }
            if text.hasSuffix(".") { text.removeLast() }
        }
        return text
    }

    /// "32.8B · Q4_K_M · 32K context" from live specs; nil when none are known.
    public static func specLine(_ metadata: OllamaModelMetadata?) -> String? {
        guard let metadata else { return nil }
        var parts: [String] = []
        if let size = metadata.parameterSize { parts.append(size) }
        if let quant = metadata.quantization { parts.append(quant) }
        if let ctx = metadata.contextLength { parts.append("\(ctx / 1000)K context") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// "117.4M downloads on ollama.com · updated 1 year ago" from the model's
    /// live page stats; nil when neither stat is known.
    public static func popularityLine(_ stats: LocalProviderModelStore.LocalModelPageStats?) -> String? {
        guard let stats else { return nil }
        var parts: [String] = []
        if let downloads = stats.downloads { parts.append("\(downloads) downloads on ollama.com") }
        if let updated = stats.updated { parts.append("updated \(updated)") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    /// "Artificial Analysis: intelligence 62.9 · coding 55.8 · 153.8 tok/s"
    /// from the live leaderboard entry; nil when no rank (or no API key).
    public static func rankLine(_ rank: ArtificialAnalysisStore.ModelRank?) -> String? {
        guard let rank else { return nil }
        var parts: [String] = []
        if let index = rank.intelligenceIndex { parts.append("intelligence \(formatted(index))") }
        if let index = rank.codingIndex { parts.append("coding \(formatted(index))") }
        if let speed = rank.outputTokensPerSecond { parts.append("\(formatted(speed)) tok/s") }
        return parts.isEmpty ? nil : "Artificial Analysis: " + parts.joined(separator: " · ")
    }

    private static func formatted(_ value: Double) -> String {
        String(format: value == value.rounded() ? "%.0f" : "%.1f", value)
    }

    /// The curated blurb, else the live-fetched description (`fetched`: the
    /// ollama.com page blurb for local models, hosted-catalog text for remote
    /// ones — see `LocalProviderModelStore.fetchModelInfo`), else the curated
    /// good-for line, else a plain placeholder.
    public static func descriptionText(item: ModelPickerItem, fetched: String? = nil) -> String {
        if let text = item.description, !text.isEmpty { return text }
        if let fetched, !fetched.isEmpty { return fetched }
        if let goodFor = item.goodFor, !goodFor.isEmpty { return "Good for: \(goodFor)" }
        return "No description yet."
    }

    /// The memory-fit line for a loopback model of known on-disk size — the text
    /// the chooser renders as its own spec-style line PLUS the tier that styles it,
    /// in one call (ok: "8.9 GB (~17% of RAM)", warn: "20.0 GB ⚠ large: ~38% of
    /// RAM", block: "51.0 GB — won't run: exceeds memory budget"). `nil` when the
    /// size is unknown — an unfetched loopback model or a remote provider, which
    /// never has a size to pass in. Hosts with stored threshold overrides pass
    /// warnPct/blockPct (stenographer has no override UI yet, so defaults apply).
    public static func fitLine(
        sizeBytes: Int?, physicalRAM: UInt64,
        warnPct: Int = ModelFitPolicy.defaultWarnPct,
        blockPct: Int = ModelFitPolicy.defaultBlockPct
    ) -> ModelFitPolicy.FitInfo? {
        ModelFitPolicy.fitInfo(diskBytes: sizeBytes, physicalRAM: physicalRAM,
                               warnPct: warnPct, blockPct: blockPct)
    }

    /// The confirmation-dialog body for a warn-tier selection; `nil` for ok/block
    /// tiers or an unknown size. Block-tier models stay silently selectable — the
    /// daemon refuses them at inference time and the fit line already says
    /// "won't run" — so only warn-tier prompts before accepting.
    public static func warnPrompt(
        model: String, sizeBytes: Int?, physicalRAM: UInt64,
        warnPct: Int = ModelFitPolicy.defaultWarnPct,
        blockPct: Int = ModelFitPolicy.defaultBlockPct
    ) -> String? {
        guard let sizeBytes,
              ModelFitPolicy.tier(diskBytes: sizeBytes, physicalRAM: physicalRAM,
                                  warnPct: warnPct, blockPct: blockPct) == .warn else { return nil }
        let estimated = ModelFitPolicy.estimatedBytes(diskBytes: sizeBytes)
        return "\(model) will hold "
            + ModelFitPolicy.footprintDescription(estimatedBytes: estimated, physicalRAM: physicalRAM)
            + " resident while it works. Use it anyway?"
    }
}

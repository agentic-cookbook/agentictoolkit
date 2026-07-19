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

    /// Capability badges — prefer the live server list (title-cased), else derive
    /// `["Tools"]` from a curated `tools == true`.
    public static func capabilityBadges(item: ModelPickerItem, metadata: OllamaModelMetadata?) -> [String] {
        if let metadata, !metadata.capabilities.isEmpty {
            return metadata.capabilities
                .filter { $0 != "completion" }
                .map { $0.prefix(1).uppercased() + $0.dropFirst() }
        }
        return item.tools == true ? ["Tools"] : []
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

    /// The curated blurb, or a plain placeholder for models with none.
    public static func descriptionText(item: ModelPickerItem) -> String {
        if let text = item.description, !text.isEmpty { return text }
        if let goodFor = item.goodFor, !goodFor.isEmpty { return "Good for: \(goodFor)" }
        return "No description yet."
    }

    /// The memory-fit line for a loopback model of known on-disk size: reuses
    /// `ModelFitPolicy.pickerLabel` and drops the leading "model — " so the chooser
    /// can render it as its own spec-style line (ok: "8.9 GB (~17% of RAM)", warn:
    /// "20.0 GB ⚠ large: ~38% of RAM", block: "51.0 GB — won't run: exceeds memory
    /// budget"). `nil` when the size is unknown — an unfetched loopback model or a
    /// remote provider, which never has a size to pass in.
    public static func fitLine(model: String, sizeBytes: Int?, physicalRAM: UInt64) -> String? {
        guard let sizeBytes else { return nil }
        let label = ModelFitPolicy.pickerLabel(model: model, diskBytes: sizeBytes, physicalRAM: physicalRAM)
        let prefix = "\(model) — "
        guard label.hasPrefix(prefix) else { return nil }
        return String(label.dropFirst(prefix.count))
    }

    /// The confirmation-dialog body for a warn-tier selection; `nil` for ok/block
    /// tiers or an unknown size. Block-tier models stay silently selectable — the
    /// daemon refuses them at inference time and the fit line already says
    /// "won't run" — so only warn-tier prompts before accepting.
    public static func warnPrompt(model: String, sizeBytes: Int?, physicalRAM: UInt64) -> String? {
        guard let sizeBytes,
              ModelFitPolicy.tier(diskBytes: sizeBytes, physicalRAM: physicalRAM) == .warn else { return nil }
        let estimated = ModelFitPolicy.estimatedBytes(diskBytes: sizeBytes)
        let pct = ModelFitPolicy.ramPct(estimated, of: physicalRAM)
        return "\(model) will hold ~\(ModelFitPolicy.gbString(estimated)) resident (~\(pct)% of RAM) "
            + "while it works. Use it anyway?"
    }
}

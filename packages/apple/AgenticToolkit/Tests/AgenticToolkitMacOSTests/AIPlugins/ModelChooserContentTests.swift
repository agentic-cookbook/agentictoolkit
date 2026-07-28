import Foundation
import Testing
import AIPluginKit
import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("ModelChooserContent")
@MainActor
struct ModelChooserContentTests {

    @Test("supportsLiveModels only for openai-shaped plugins")
    func liveGate() {
        #expect(ModelChooserContent.supportsLiveModels(pluginIdentifier: "x.openai-compatible"))
        #expect(ModelChooserContent.supportsLiveModels(pluginIdentifier: "x.openai"))
        #expect(ModelChooserContent.supportsLiveModels(pluginIdentifier: "x.anthropic") == false)
    }

    @Test("offeredModels appends a missing current selection")
    func offered() {
        #expect(ModelChooserContent.offeredModels(listed: ["a", "b"], current: "c") == ["a", "b", "c"])
        #expect(ModelChooserContent.offeredModels(listed: ["a", "b"], current: "a") == ["a", "b"])
        #expect(ModelChooserContent.offeredModels(listed: ["a"], current: "") == ["a"])
    }

    @Test("capabilityBadges prefer live capabilities, then the shared catalog, then curated tools")
    func badges() {
        let live = OllamaModelMetadata(
            capabilities: ["tools", "vision"], parameterSize: nil, quantization: nil, contextLength: nil
        )
        let badges = ModelChooserContent.capabilityBadges(
            item: ModelPickerItem(id: "m"), metadata: live
        )
        #expect(badges == ["Tools", "Vision"])
        // A live server outranks the catalog: it is the machine actually serving it.
        let catalogued = ModelPickerItem(id: "m", info: AIModelCatalog.ResolvedModel(
            id: "m", capabilities: ["reasoning", "tools"]))
        #expect(ModelChooserContent.capabilityBadges(item: catalogued, metadata: live)
            == ["Tools", "Vision"])
        #expect(ModelChooserContent.capabilityBadges(item: catalogued, metadata: nil)
            == ["Reasoning", "Tools"])
        let curated = ModelPickerItem(id: "m", tools: true)
        #expect(ModelChooserContent.capabilityBadges(item: curated, metadata: nil) == ["Tools"])
        #expect(ModelChooserContent.capabilityBadges(item: ModelPickerItem(id: "m"), metadata: nil) == [])
    }

    @Test("factsLine reports the gateway's limits and prices, not the model's capabilities")
    func factsLine() {
        let full = AIModelCatalog.ResolvedModel(
            id: "m", capabilities: ["tools"], contextWindow: 131_072, maxOutput: 65_536,
            inputCostPerM: 0.15, outputCostPerM: 0.6)
        // Binary limits read the way the vendor quotes them: 131072 is "128K".
        #expect(ModelChooserContent.factsLine(full)
            == "128K context · 64K max output · $0.15/$0.6 per M tokens")
        #expect(ModelChooserContent.factsLine(
            AIModelCatalog.ResolvedModel(id: "m", contextWindow: 1_000_000)) == "1M context")
        #expect(ModelChooserContent.factsLine(
            AIModelCatalog.ResolvedModel(id: "m", contextWindow: 1_048_576)) == "1M context")
        // A decimal limit stays decimal — 200000 is "200K", never "195K".
        #expect(ModelChooserContent.factsLine(
            AIModelCatalog.ResolvedModel(id: "m", contextWindow: 200_000)) == "200K context")
        // A published half-price says which half it is.
        #expect(ModelChooserContent.factsLine(
            AIModelCatalog.ResolvedModel(id: "m", inputCostPerM: 1.75))
            == "$1.75 per M input tokens")
        // Free models and sub-cent prices both have to survive the formatting.
        #expect(ModelChooserContent.factsLine(
            AIModelCatalog.ResolvedModel(id: "m", inputCostPerM: 0, outputCostPerM: 0.435))
            == "$0/$0.435 per M tokens")
        // Capabilities alone are not facts about the gateway.
        #expect(ModelChooserContent.factsLine(
            AIModelCatalog.ResolvedModel(id: "m", capabilities: ["tools"])) == nil)
        #expect(ModelChooserContent.factsLine(AIModelCatalog.ResolvedModel(id: "m")) == nil)
    }

    @Test("specLine formats size, quant, and context")
    func specs() {
        let meta = OllamaModelMetadata(
            capabilities: [], parameterSize: "32.8B", quantization: "Q4_K_M", contextLength: 32768
        )
        #expect(ModelChooserContent.specLine(meta) == "32.8B · Q4_K_M · 32K context")
        #expect(ModelChooserContent.specLine(nil) == nil)
    }

    @Test("descriptionText uses curated text or a placeholder")
    func description() {
        let item1 = ModelPickerItem(id: "m", description: "Balanced.")
        #expect(ModelChooserContent.descriptionText(item: item1) == "Balanced.")
        let item2 = ModelPickerItem(id: "m")
        #expect(ModelChooserContent.descriptionText(item: item2) == "No description yet.")
    }

    @Test("fitLine returns text and tier in one call, nil for unknown size")
    func fitLine() {
        let ram: UInt64 = 64_000_000_000
        let okInfo = ModelChooserContent.fitLine(sizeBytes: 8_900_000_000, physicalRAM: ram)
        #expect(okInfo?.text == "8.9 GB (~17% of RAM)")
        #expect(okInfo?.tier == .ok)
        let warnInfo = ModelChooserContent.fitLine(sizeBytes: 20_000_000_000, physicalRAM: ram)
        #expect(warnInfo?.text == "20.0 GB ⚠ large: ~38% of RAM")
        #expect(warnInfo?.tier == .warn)
        let blockInfo = ModelChooserContent.fitLine(sizeBytes: 51_000_000_000, physicalRAM: ram)
        #expect(blockInfo?.text == "51.0 GB — won't run: exceeds memory budget")
        #expect(blockInfo?.tier == .block)
        #expect(ModelChooserContent.fitLine(sizeBytes: nil, physicalRAM: ram) == nil)
    }

    @Test("threshold overrides flip a model's tier in fitLine output")
    func fitLineThresholdOverrides() {
        let ram: UInt64 = 64_000_000_000
        // 20 GB disk → 24 GB est = 37.5% of RAM: warn at the defaults, block once
        // an overridden blockPct drops to 30.
        let overridden = ModelChooserContent.fitLine(
            sizeBytes: 20_000_000_000, physicalRAM: ram, warnPct: 10, blockPct: 30)
        #expect(overridden?.tier == .block)
        #expect(overridden?.text == "20.0 GB — won't run: exceeds memory budget")
    }

    @Test("warnPrompt only fires for warn-tier selections")
    func warnPromptTest() {
        let ram: UInt64 = 64_000_000_000
        let text = ModelChooserContent.warnPrompt(model: "m", sizeBytes: 20_000_000_000, physicalRAM: ram)
        // The size+pct core comes from the shared footprintDescription helper.
        #expect(text?.contains("~24.0 GB (~38% of RAM)") == true)
        #expect(ModelChooserContent.warnPrompt(model: "m", sizeBytes: 8_900_000_000, physicalRAM: ram) == nil)
        #expect(ModelChooserContent.warnPrompt(model: "m", sizeBytes: 51_000_000_000, physicalRAM: ram) == nil)
        #expect(ModelChooserContent.warnPrompt(model: "m", sizeBytes: nil, physicalRAM: ram) == nil)
        // Overridden thresholds flow through: 8.9 GB (16.7% est) turns warn-tier
        // when warnPct drops to 10.
        #expect(ModelChooserContent.warnPrompt(
            model: "m", sizeBytes: 8_900_000_000, physicalRAM: ram, warnPct: 10, blockPct: 50) != nil)
    }
}

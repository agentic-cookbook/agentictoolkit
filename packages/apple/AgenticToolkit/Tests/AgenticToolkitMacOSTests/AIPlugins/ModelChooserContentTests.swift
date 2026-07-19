import Foundation
import Testing
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

    @Test("capabilityBadges prefer live capabilities, fall back to curated tools")
    func badges() {
        let live = OllamaModelMetadata(
            capabilities: ["tools", "vision"], parameterSize: nil, quantization: nil, contextLength: nil
        )
        let badges = ModelChooserContent.capabilityBadges(
            item: ModelPickerItem(id: "m"), metadata: live
        )
        #expect(badges == ["Tools", "Vision"])
        let curated = ModelPickerItem(id: "m", tools: true)
        #expect(ModelChooserContent.capabilityBadges(item: curated, metadata: nil) == ["Tools"])
        #expect(ModelChooserContent.capabilityBadges(item: ModelPickerItem(id: "m"), metadata: nil) == [])
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
}

import Foundation
import Testing
@testable import AIPluginKit

@Suite("ModelCapability")
struct ModelCapabilityTests {

    @Test("A reported capability is recognised whatever the gateway calls it")
    func reportedSpellings() {
        for spelling in ["tools", "Tools", "tool_use", "function_calling", "functionCalling"] {
            #expect(ModelCapability.reports(.tools, in: [spelling]), "\(spelling) should read as tools")
        }
        #expect(ModelCapability.reports(.reasoning, in: ["thinking"]))
        #expect(ModelCapability.reports(.vision, in: ["multimodal"]))
        // Not a free-for-all: an unrelated capability still reads as absent.
        #expect(ModelCapability.reports(.vision, in: ["tools", "reasoning"]) == false)
        #expect(ModelCapability.reports(.conversation, in: ["chat"]) == false)
    }

    @Test("A curated tools flag counts even when the gateway reported other capabilities")
    func curatedToolsFlag() {
        let visionOnly = AIModelCatalog.ResolvedModel(id: "m", capabilities: ["vision"], tools: true)
        #expect(ModelCapability.has(.tools, visionOnly))
        #expect(ModelCapability.capabilities(of: visionOnly) == [.tools, .vision])
    }

    @Test("Chat is read out of the prose, including prose only the caller has")
    func conversationFromProse() {
        let bare = AIModelCatalog.ResolvedModel(id: "m")
        #expect(ModelCapability.has(.conversation, bare) == false)
        #expect(ModelCapability.has(.conversation, bare, extraText: "A chat assistant model"))
        #expect(ModelCapability.capabilities(of: bare, extraText: "A chat assistant model")
            == [.conversation])

        let described = AIModelCatalog.ResolvedModel(id: "m", description: "Built for conversation")
        #expect(ModelCapability.has(.conversation, described))
    }

    @Test("Reasoning and vision are never inferred from prose")
    func hardCapabilitiesAreNotInferred() {
        // The check-mark column claims the gateway asserted the capability. Marketing
        // copy is not that assertion, however emphatically it reasons about reasoning.
        let prose = AIModelCatalog.ResolvedModel(
            id: "m", description: "Exceptional reasoning over images and charts")
        #expect(ModelCapability.has(.reasoning, prose) == false)
        #expect(ModelCapability.has(.vision, prose) == false)
    }
}

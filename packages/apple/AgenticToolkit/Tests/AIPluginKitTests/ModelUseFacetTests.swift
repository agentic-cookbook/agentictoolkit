import Foundation
import Testing
@testable import AIPluginKit

@Suite("ModelUseFacet")
struct ModelUseFacetTests {

    @Test("derives facets from description prose")
    func fromText() {
        let facets = ModelUseFacet.facets(
            text: "A model for coding, debugging and creative writing")
        #expect(facets.contains(.coding))
        #expect(facets.contains(.writing))
        #expect(facets.contains(.conversation) == false)
    }

    @Test("word prefixes are anchored at a word start")
    func anchoredPrefixes() {
        // "cod" must not fire on "encoded" / "decoder".
        #expect(ModelUseFacet.facets(text: "encoded tokens are decoded").contains(.coding) == false)
        #expect(ModelUseFacet.facets(text: "codes and coding").contains(.coding))
    }

    @Test("phrases catch evidence that spans words or hyphens")
    func phrases() {
        #expect(ModelUseFacet.facets(text: "supports function calling").contains(.agents))
        #expect(ModelUseFacet.facets(text: "a long-context model").contains(.research))
        #expect(ModelUseFacet.facets(text: "step-by-step").contains(.problemSolving))
        #expect(ModelUseFacet.facets(text: "cost-effective for high volume").contains(.economy))
    }

    @Test("reported capabilities imply their facet without any prose")
    func capabilitiesImply() {
        let facets = ModelUseFacet.facets(text: "", capabilities: ["tools", "vision", "reasoning"])
        #expect(facets == [.agents, .vision, .problemSolving])
    }

    @Test("facets(for:) reads id, description, goodFor and the extra text")
    func fromResolvedModel() {
        let model = AIModelCatalog.ResolvedModel(
            id: "qwen3-coder", description: "General purpose.", goodFor: "translation")
        #expect(ModelUseFacet.facets(for: model).isSuperset(of: [.coding, .translation]))
        // A live blurb the catalog never had still earns facets.
        #expect(ModelUseFacet.facets(for: AIModelCatalog.ResolvedModel(id: "mystery"),
                                     extraText: "excels at math and logic puzzles")
            .contains(.problemSolving))
    }

    @Test("an empty selection filters nothing")
    func emptySelectionPasses() {
        #expect(ModelUseFacet.matches(facets: [.coding], selected: []))
        #expect(ModelUseFacet.matches(facets: [], selected: []))
    }

    @Test("selecting several facets means ANY of them")
    func orSemantics() {
        #expect(ModelUseFacet.matches(facets: [.coding], selected: [.coding, .writing]))
        #expect(ModelUseFacet.matches(facets: [.writing], selected: [.coding, .writing]))
        #expect(ModelUseFacet.matches(facets: [.vision], selected: [.coding, .writing]) == false)
    }

    @Test("a model with no evidence at all always passes")
    func unknownPasses() {
        #expect(ModelUseFacet.matches(facets: [], selected: [.coding]))
    }

    @Test("every facet has a title and a tooltip")
    func labels() {
        for facet in ModelUseFacet.allCases {
            #expect(!facet.title.isEmpty)
            #expect(!facet.detail.isEmpty)
        }
    }
}

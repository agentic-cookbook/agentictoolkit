import Foundation
import Testing
@testable import AgenticToolkitCore

@Suite("ModelCatalogStore")
struct ModelCatalogStoreTests {

    @Test("parseOpenRouter maps ids to descriptions and skips empty ones")
    func parsesOpenRouter() {
        let json = """
        {"data":[
          {"id":"qwen/qwen3-coder-next","description":"Sparse MoE coding model."},
          {"id":"empty/desc","description":""},
          {"id":"no/desc"}
        ]}
        """
        let parsed = ModelCatalogStore.parseOpenRouter(Data(json.utf8))
        #expect(parsed == ["qwen/qwen3-coder-next": "Sparse MoE coding model."])
    }

    @Test("parseModelsDev flattens providers; first provider in sorted order wins")
    func parsesModelsDev() {
        let json = """
        {"zeta":{"models":{"gpt-5":{"description":"zeta copy"}}},
         "alpha":{"models":{"gpt-5":{"description":"alpha copy"},
                            "bare":{"name":"no description"}}},
         "noModels":{"name":"provider without models"}}
        """
        let parsed = ModelCatalogStore.parseModelsDev(Data(json.utf8))
        #expect(parsed == ["gpt-5": "alpha copy"])
    }

    @Test("parseAdhCatalog maps model names to descriptions and skips empty ones")
    func parsesAdhCatalog() {
        let json = """
        {"items":[{"name":"DeepSeek","models":[
          {"name":"deepseek-chat","description":"Flagship open-weights chat model."},
          {"name":"deepseek-reasoner","description":""}]}],
         "total":1,"page":1,"pageSize":100}
        """
        let parsed = ModelCatalogStore.parseAdhCatalog(Data(json.utf8))
        #expect(parsed["deepseek-chat"] == "Flagship open-weights chat model.")
        #expect(parsed["deepseek-reasoner"] == nil)
    }

    @Test("bestMatch takes an exact base-name match, ignoring namespace and tag")
    func exactMatch() {
        let catalog = ["qwen/qwen3-coder-next": "the one", "qwen/qwen3-coder": "wrong"]
        #expect(ModelCatalogStore.bestMatch(for: "qwen3-coder-next:latest", in: catalog) == "the one")
    }

    @Test("bestMatch prefers the candidate carrying the model's size tag")
    func sizePreference() {
        let catalog = [
            "meta-llama/llama-3.1-70b-instruct": "seventy",
            "meta-llama/llama-3.1-8b-instruct": "eight",
            "aion-labs/aion-rp-llama-3.1-8b": "not-prefix-anchored"
        ]
        #expect(ModelCatalogStore.bestMatch(for: "llama3.1:8b", in: catalog) == "eight")
    }

    @Test("bestMatch never matches a 4b tag against a 24b candidate")
    func sizeDigitBoundary() {
        let catalog = ["qwen/qwen3.5-24b-instruct": "twenty-four"]
        #expect(ModelCatalogStore.bestMatch(for: "qwen3.5:4b", in: catalog) == nil)
    }

    @Test("bestMatch is prefix-anchored: fine-tunes never inherit the base blurb")
    func noFineTuneInheritance() {
        let catalog = ["qwen/qwen3.5": "official base model"]
        #expect(ModelCatalogStore.bestMatch(for: "vaultbox/qwen3.5-uncensored:4b", in: catalog) == nil)
    }

    @Test("bestMatch retries with a trailing -latest stripped from the id")
    func latestSuffix() {
        let catalog = ["x-ai/grok-2-1212": "grok"]
        #expect(ModelCatalogStore.bestMatch(for: "grok-2-latest", in: catalog) == "grok")
        #expect(ModelCatalogStore.bestMatch(for: "latest", in: catalog) == nil)
    }

    @Test("bestMatch prefers the shortest qualifying id, deterministically")
    func shortestWins() {
        let catalog = [
            "qwen/qwen-2.5-coder-32b-instruct": "short",
            "qwen/qwen-2.5-coder-32b-instruct-turbo": "long"
        ]
        #expect(ModelCatalogStore.bestMatch(for: "qwen2.5-coder:32b", in: catalog) == "short")
    }

    @Test("bestMatch returns nil for empty names and empty catalogs")
    func degenerateInputs() {
        #expect(ModelCatalogStore.bestMatch(for: "", in: ["a": "b"]) == nil)
        #expect(ModelCatalogStore.bestMatch(for: ":16b", in: ["a": "b"]) == nil)
        #expect(ModelCatalogStore.bestMatch(for: "llama3.1", in: [:]) == nil)
    }

    @Test("merged falls back per side: one failed catalog never blanks the other")
    func mergedPerSideFallback() {
        let previous = ModelCatalogStore.Catalog(
            openRouter: ["old/or": "or"], modelsDev: ["old-md": "md"], adh: ["old-adh": "adh"])
        let halfRound = ModelCatalogStore.Catalog(
            openRouter: ["new/or": "fresh"], modelsDev: [:], adh: [:])
        let merged = ModelCatalogStore.merged(halfRound, lastGood: previous)
        #expect(merged.openRouter == ["new/or": "fresh"])
        #expect(merged.modelsDev == ["old-md": "md"])
        #expect(merged.adh == ["old-adh": "adh"])

        let bothFailed = ModelCatalogStore.Catalog(openRouter: [:], modelsDev: [:], adh: [:])
        #expect(ModelCatalogStore.merged(bothFailed, lastGood: previous).openRouter == ["old/or": "or"])
        #expect(ModelCatalogStore.merged(halfRound, lastGood: nil).modelsDev.isEmpty)
    }

    @Test("isSubstantial rejects bare URLs and single words, accepts real blurbs")
    func substantiality() {
        #expect(!ModelCatalogStore.isSubstantial("www.vaultbox.ai"))
        #expect(!ModelCatalogStore.isSubstantial("Uncensored"))
        #expect(ModelCatalogStore.isSubstantial(
            "An open-source Mixture-of-Experts code language model."))
    }
}

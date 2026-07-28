import Foundation
import Testing
@testable import AIPluginKit

/// The shared model table: lookup by every gateway spelling, per-gateway terms,
/// and how curated `modelDetails` merge with it.
@Suite("AIModelCatalog")
struct AIModelCatalogTests {

    private static let sample = AIModelCatalog(
        schemaVersion: 1, generatedAt: "2026-07-28T00:00:00Z",
        models: [
            AIModelCatalog.Model(
                id: "gpt-oss-120b",
                aliases: ["accounts/fireworks/models/gpt-oss-120b", "openai/gpt-oss-120b"],
                description: "An open-weight MoE model.",
                capabilities: ["reasoning", "tools"]),
            AIModelCatalog.Model(id: "llama-3.3-70b-instruct",
                                 aliases: ["meta-llama/Llama-3.3-70B-Instruct"])
        ],
        offerings: [
            "groq": ["openai/gpt-oss-120b": AIModelCatalog.Offering(
                contextWindow: 131_072, maxOutput: 65_536,
                inputCostPerM: 0.15, outputCostPerM: 0.6)],
            "fireworks": ["accounts/fireworks/models/gpt-oss-120b": AIModelCatalog.Offering(
                contextWindow: 1_000_000)]
        ])

    private func template(id: String, models: [String] = [],
                          details: [AIPluginDescriptor.ModelDetail]? = nil)
        -> AIPluginDescriptor.ProviderTemplate {
        AIPluginDescriptor.ProviderTemplate(
            id: id, displayName: id, models: models, modelDetails: details)
    }

    // MARK: - Canonicalization

    @Test("A gateway namespace, price tier and quantization suffix all fold to one id")
    func canonicalID() {
        #expect(AIModelCatalog.canonicalID("meta-llama/Llama-3.3-70B-Instruct")
            == "llama-3.3-70b-instruct")
        #expect(AIModelCatalog.canonicalID("@cf/meta/llama-3.3-70b-instruct-fp8-fast")
            == "llama-3.3-70b-instruct")
        #expect(AIModelCatalog.canonicalID("deepseek/deepseek-r1:free") == "deepseek-r1")
    }

    @Test("Suffixes that name a different model survive canonicalization")
    func canonicalIDKeepsMeaningfulSuffixes() {
        #expect(AIModelCatalog.canonicalID("gpt-4-turbo") == "gpt-4-turbo")
        #expect(AIModelCatalog.canonicalID("grok-2-latest") == "grok-2-latest")
    }

    // MARK: - Lookup

    @Test("A model resolves by canonical id, by any gateway's alias, and case-insensitively")
    func lookupByEverySpelling() {
        for name in ["gpt-oss-120b", "openai/gpt-oss-120b",
                     "accounts/fireworks/models/gpt-oss-120b", "OpenAI/GPT-OSS-120B"] {
            #expect(Self.sample.model(named: name)?.id == "gpt-oss-120b", "\(name) did not resolve")
        }
    }

    @Test("A spelling the catalog has never seen still resolves through canonicalization")
    func lookupFallsBackToCanonicalForm() {
        // No gateway in the table spells it this way; the canonical form matches.
        #expect(Self.sample.model(named: "@cf/openai/gpt-oss-120b-fp8")?.id == "gpt-oss-120b")
        #expect(Self.sample.model(named: "nonesuch-9b") == nil)
    }

    @Test("Terms are per gateway, under that gateway's own spelling")
    func offeringsAreScopedToTheGateway() {
        #expect(Self.sample.offering(templateID: "groq",
                                     model: "openai/gpt-oss-120b")?.contextWindow == 131_072)
        #expect(Self.sample.offering(
            templateID: "fireworks",
            model: "accounts/fireworks/models/gpt-oss-120b")?.contextWindow == 1_000_000)
        // Right model, wrong gateway's spelling: no terms, rather than the wrong ones.
        #expect(Self.sample.offering(templateID: "groq",
                                     model: "accounts/fireworks/models/gpt-oss-120b") == nil)
    }

    // MARK: - Resolution

    @Test("The shared description and this gateway's terms merge into one model")
    func resolveMergesSharedFactsWithGatewayTerms() {
        let info = Self.sample.resolve(model: "openai/gpt-oss-120b", template: template(id: "groq"))
        #expect(info.description == "An open-weight MoE model.")
        #expect(info.capabilities == ["reasoning", "tools"])
        #expect(info.tools == true)            // derived from the capability list
        #expect(info.contextWindow == 131_072)
        #expect(info.inputCostPerM == 0.15)
    }

    @Test("Curated modelDetails win over the generated blurb")
    func curatedCopyWins() {
        let curated = AIPluginDescriptor.ModelDetail(
            id: "openai/gpt-oss-120b", description: "Hand-written.", tools: false,
            goodFor: "Long context")
        let info = Self.sample.resolve(model: "openai/gpt-oss-120b",
                                       template: template(id: "groq", details: [curated]))
        #expect(info.description == "Hand-written.")
        #expect(info.tools == false)
        #expect(info.goodFor == "Long context")
        // Curated copy overrides the blurb, not the gateway's numbers.
        #expect(info.contextWindow == 131_072)
    }

    @Test("A model with no shared facts and no terms resolves empty rather than failing")
    func resolveUnknownModel() {
        let info = Self.sample.resolve(model: "nonesuch-9b", template: template(id: "groq"))
        #expect(info.id == "nonesuch-9b")
        #expect(info.isEmpty)
    }

    @Test("Tool support is unknown, not false, when nothing reports it")
    func toolsStayUnknownWithoutEvidence() {
        let info = Self.sample.resolve(model: "llama-3.3-70b-instruct",
                                       template: template(id: "nowhere"))
        #expect(info.tools == nil)
    }

    // MARK: - Decoding + the shipped resource

    @Test("Absent fields decode to empty rather than failing the whole catalog")
    func decodesSparseEntries() throws {
        let json = #"{"schemaVersion":1,"models":[{"id":"m"}]}"#
        let catalog = try JSONDecoder().decode(AIModelCatalog.self, from: Data(json.utf8))
        let model = try #require(catalog.model(named: "m"))
        #expect(model.aliases.isEmpty)
        #expect(model.description == nil)
        #expect(model.capabilities.isEmpty)
        #expect(catalog.offerings.isEmpty)
    }

    @Test("The catalog shipped inside AIPluginKit loads and is populated")
    func shippedCatalogLoads() throws {
        let catalog = try #require(AIModelCatalog.load())
        #expect(catalog.schemaVersion == 1)
        #expect(catalog.models.count > 100)
        #expect(!catalog.offerings.isEmpty)
        // Every entry the generator emits is at least identified by its own id.
        #expect(catalog.models.allSatisfy { !$0.id.isEmpty })
        // The overwhelming majority carry the blurb that is the point of sharing.
        let described = catalog.models.filter { $0.description?.isEmpty == false }.count
        #expect(described * 10 > catalog.models.count * 8)
    }

    @Test("A missing resource yields an empty catalog, never a crash")
    func missingResourceIsSurvivable() {
        #expect(AIModelCatalog.load(from: Bundle(for: NSNull.self)) == nil)
        // `shared` is the load-or-empty form the UI actually reads.
        #expect(AIModelCatalog.shared.schemaVersion >= 0)
    }
}

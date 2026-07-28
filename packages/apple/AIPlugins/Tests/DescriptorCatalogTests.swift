import Foundation
import Testing
import AIPluginKit

/// Decodes each *shipping* `descriptor.json` — read straight from the plugin
/// sources on disk, not an inline copy — to guard the JSON shape the host
/// loads: schema v3, the expected template ids, and default models. Because the
/// real files are the ones under test, a typo or drift in any descriptor.json
/// fails this suite (an inline copy would silently pass while the shipped file
/// broke).
@Suite("Shipping descriptor catalog")
struct DescriptorCatalogTests {

    /// `…/packages/apple/AIPlugins`, derived from this test file's own location
    /// (`…/AIPlugins/Tests/DescriptorCatalogTests.swift`) so the real
    /// `<Bundle>/descriptor.json` files are what these tests decode.
    private static let pluginsRoot = URL(filePath: #filePath)
        .deletingLastPathComponent()   // Tests/
        .deletingLastPathComponent()   // AIPlugins/

    /// Decodes the shipping `descriptor.json` for the named plugin bundle dir.
    private func shipped(_ bundleDir: String) throws -> AIPluginDescriptor {
        let url = Self.pluginsRoot.appending(path: "\(bundleDir)/descriptor.json")
        let data = try Data(contentsOf: url)
        return try JSONDecoder().decode(AIPluginDescriptor.self, from: data)
    }

    @Test("OpenAI descriptor advertises the openai template at schema v3")
    func openAIDescriptor() throws {
        let descriptor = try shipped("OpenAI")
        #expect(descriptor.schemaVersion == 3)
        #expect(descriptor.resolvedTemplates.map(\.id) == ["openai"])
        #expect(descriptor.resolvedTemplates[0].resolvedDefaultModel == "gpt-4.1")
    }

    @Test("Google descriptor advertises the gemini template")
    func googleDescriptor() throws {
        let descriptor = try shipped("Google")
        #expect(descriptor.resolvedTemplates.map(\.id) == ["gemini"])
        #expect(descriptor.resolvedTemplates[0].resolvedDefaultModel == "gemini-2.5-flash")
    }

    @Test("ClaudeLocal descriptor advertises the claude-local template with no fields")
    func claudeLocalDescriptor() throws {
        let descriptor = try shipped("ClaudeLocal")
        let template = try #require(descriptor.resolvedTemplates.first)
        #expect(template.id == "claude-local")
        #expect(template.secretRequired == false)
        #expect(descriptor.fields(for: template).isEmpty)
    }

    @Test("OpenAI-compatible xAI template advertises the current Grok models with a fixed base URL")
    func openAICompatibleXAITemplate() throws {
        let descriptor = try shipped("OpenAICompatible")
        #expect(descriptor.schemaVersion == 3)
        let xai = try #require(descriptor.resolvedTemplates.first { $0.id == "xai" })
        // The model list is regenerated from adh's catalog, so assert the curated
        // parts — pinning the whole list would just churn on every refresh.
        #expect(xai.resolvedDefaultModel == "grok-4.5")
        #expect(xai.models.contains(xai.resolvedDefaultModel))
        #expect(xai.models.contains("grok-4.3"))
        #expect(xai.defaultValues["baseURL"] == "https://api.x.ai/v1")
        #expect(xai.secretRequired == true)
    }

    @Test("Every OpenAI-compatible template is curated and preselects a model it offers")
    func openAICompatibleTemplatesAreCurated() throws {
        let descriptor = try shipped("OpenAICompatible")
        for template in descriptor.resolvedTemplates {
            // Generated entries arrive bare; an uncurated one shows a blank LLM column
            // and an empty details pane in the picker.
            #expect(template.provider?.isEmpty == false, "\(template.id) has no provider")
            #expect(template.providerDescription?.isEmpty == false, "\(template.id) has no blurb")
            if let selected = template.defaultModel {
                #expect(template.models.contains(selected), "\(template.id) preselects a model it doesn't offer")
            }
        }
    }

    @Test("OpenAI-compatible Ollama template is keyless and ships no fabricated models")
    func openAICompatibleOllamaTemplate() throws {
        let descriptor = try shipped("OpenAICompatible")
        let ollama = try #require(descriptor.resolvedTemplates.first { $0.id == "ollama" })
        #expect(ollama.secretRequired == false)
        // Keyless: the template drops the shared apiKey field, leaving only baseURL.
        #expect(descriptor.fields(for: ollama).map(\.key) == ["baseURL"])
        #expect(ollama.defaultValues["baseURL"] == "http://localhost:11434/v1")
        // No hardcoded model list. A local server only serves the models the user has
        // pulled — the editor reads those live from GET {baseURL}/models. Shipping
        // placeholder names (e.g. "llama3.2") only lets the user pick a model they
        // don't have and hit "model not found".
        #expect(ollama.models.isEmpty)
        #expect(ollama.resolvedDefaultModel == "")
    }
}

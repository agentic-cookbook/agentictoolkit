import Foundation
import Testing
import AIPluginKit

/// Decodes each shipping descriptor.json (embedded here) to guard the JSON shape
/// the host loads: schema v3, the expected template ids, and default models.
@Suite("Shipping descriptor catalog")
struct DescriptorCatalogTests {

    private func decode(_ json: String) throws -> AIPluginDescriptor {
        try JSONDecoder().decode(AIPluginDescriptor.self, from: Data(json.utf8))
    }

    @Test("OpenAI descriptor advertises the openai template at schema v3")
    func openAIDescriptor() throws {
        let descriptor = try decode(Self.openAIJSON)
        #expect(descriptor.schemaVersion == 3)
        #expect(descriptor.resolvedTemplates.map(\.id) == ["openai"])
        #expect(descriptor.resolvedTemplates[0].resolvedDefaultModel == "gpt-4.1")
    }

    @Test("Google descriptor advertises the gemini template")
    func googleDescriptor() throws {
        let descriptor = try decode(Self.googleJSON)
        #expect(descriptor.resolvedTemplates.map(\.id) == ["gemini"])
        #expect(descriptor.resolvedTemplates[0].resolvedDefaultModel == "gemini-2.5-flash")
    }

    @Test("ClaudeLocal descriptor advertises the claude-local template with no fields")
    func claudeLocalDescriptor() throws {
        let descriptor = try decode(Self.claudeLocalJSON)
        let template = try #require(descriptor.resolvedTemplates.first)
        #expect(template.id == "claude-local")
        #expect(template.secretRequired == false)
        #expect(descriptor.fields(for: template).isEmpty)
    }

    @Test("OpenAI-compatible xAI template advertises the current Grok models with a fixed base URL")
    func openAICompatibleXAITemplate() throws {
        let descriptor = try decode(Self.openAICompatibleXAIJSON)
        #expect(descriptor.schemaVersion == 3)
        let xai = try #require(descriptor.resolvedTemplates.first { $0.id == "xai" })
        #expect(xai.resolvedDefaultModel == "grok-4.5")
        #expect(xai.models == [
            "grok-4.5", "grok-4.3",
            "grok-4.20-0309-reasoning", "grok-4.20-0309-non-reasoning", "grok-4.20-multi-agent-0309"
        ])
        #expect(xai.defaultValues["baseURL"] == "https://api.x.ai/v1")
        #expect(xai.secretRequired == true)
    }

    // Paste the exact JSON written to disk into these constants.
    static let openAIJSON = #"""
    {
      "schemaVersion": 3,
      "identifier": "com.agentictoolkit.plugin.openai",
      "displayName": "OpenAI (ChatGPT)",
      "version": "1.0",
      "models": ["gpt-4.1", "gpt-4o", "gpt-4o-mini", "o1-mini"],
      "defaultModel": "gpt-4.1",
      "fields": [
        { "key": "apiKey", "label": "API Key", "kind": "secret" }
      ],
      "templates": [
        {
          "id": "openai",
          "displayName": "OpenAI",
          "defaultValues": {},
          "models": ["gpt-4.1", "gpt-4o", "gpt-4o-mini", "o1-mini"],
          "defaultModel": "gpt-4.1",
          "secretRequired": true
        }
      ]
    }
    """#
    static let googleJSON = #"""
    {
      "schemaVersion": 3,
      "identifier": "com.agentictoolkit.plugin.google",
      "displayName": "Google (Gemini)",
      "version": "1.0",
      "models": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
      "defaultModel": "gemini-2.5-flash",
      "fields": [
        { "key": "apiKey", "label": "API Key", "kind": "secret" }
      ],
      "templates": [
        {
          "id": "gemini",
          "displayName": "Gemini",
          "defaultValues": {},
          "models": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
          "defaultModel": "gemini-2.5-flash",
          "secretRequired": true
        }
      ]
    }
    """#
    static let claudeLocalJSON = #"""
    {
      "schemaVersion": 3,
      "identifier": "com.agentictoolkit.plugin.claude-local",
      "displayName": "Claude (Local)",
      "version": "1.0",
      "models": ["sonnet", "haiku", "opus"],
      "defaultModel": "sonnet",
      "fields": [],
      "templates": [
        {
          "id": "claude-local",
          "displayName": "Claude Code (local CLI)",
          "defaultValues": {},
          "models": ["sonnet", "haiku", "opus"],
          "defaultModel": "sonnet",
          "secretRequired": false,
          "fields": []
        }
      ]
    }
    """#
    // A minimal OpenAI-compatible descriptor carrying just the xAI template,
    // mirroring the model list and fixed base URL shipped in
    // OpenAICompatible/descriptor.json (pretty-printed here to satisfy
    // line-length linting, like the constants above).
    static let openAICompatibleXAIJSON = #"""
    {
      "schemaVersion": 3,
      "identifier": "com.agentictoolkit.plugin.openai-compatible",
      "displayName": "OpenAI-compatible",
      "version": "1.0",
      "models": [],
      "defaultModel": null,
      "fields": [
        { "key": "baseURL", "label": "Base URL", "kind": "text" },
        { "key": "apiKey", "label": "API Key", "kind": "secret" }
      ],
      "templates": [
        {
          "id": "xai",
          "displayName": "xAI",
          "defaultValues": { "baseURL": "https://api.x.ai/v1" },
          "models": [
            "grok-4.5", "grok-4.3",
            "grok-4.20-0309-reasoning",
            "grok-4.20-0309-non-reasoning",
            "grok-4.20-multi-agent-0309"
          ],
          "defaultModel": "grok-4.5",
          "secretRequired": true
        }
      ]
    }
    """#
}

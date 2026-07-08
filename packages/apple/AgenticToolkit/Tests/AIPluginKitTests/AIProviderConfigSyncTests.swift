import XCTest
import AIPluginKit

final class AIProviderConfigSyncTests: XCTestCase {
    func testRoundTrip() throws {
        let id = UUID()
        let sync = AIProviderConfigSync(
            enabled: true,
            selectedConfigId: id,
            configs: [
                ResolvedProviderConfig(
                    id: id, name: "Groq", pluginIdentifier: "com.x.openai-compatible",
                    templateId: "custom", model: "llama-3.3-70b",
                    values: ["baseURL": "https://api.groq.com/openai/v1"],
                    secrets: ["apiKey": "sk-abc"]
                )
            ]
        )
        let data = try JSONEncoder().encode(sync)
        let decoded = try JSONDecoder().decode(AIProviderConfigSync.self, from: data)
        XCTAssertEqual(decoded, sync)
    }

    func testDecodesMissingSelectionAsNil() throws {
        let data = Data(#"{"enabled":false,"configs":[]}"#.utf8)
        let decoded = try JSONDecoder().decode(AIProviderConfigSync.self, from: data)
        XCTAssertNil(decoded.selectedConfigId)
        XCTAssertFalse(decoded.enabled)
        XCTAssertTrue(decoded.configs.isEmpty)
    }
}

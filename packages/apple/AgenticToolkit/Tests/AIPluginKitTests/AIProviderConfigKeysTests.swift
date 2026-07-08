import XCTest
import AIPluginKit

final class AIProviderConfigKeysTests: XCTestCase {
    private let id = UUID(uuidString: "11111111-2222-3333-4444-555555555555")!

    func testFieldKeyFormat() {
        XCTAssertEqual(
            AIProviderConfigKeys.fieldKey(config: id, field: "apiKey"),
            "aiplugin.config.\(id.uuidString).field.apiKey"
        )
    }

    func testModelAndLedgerKeys() {
        XCTAssertEqual(AIProviderConfigKeys.modelKey(config: id), "aiplugin.config.\(id.uuidString).model")
        XCTAssertEqual(
            AIProviderConfigKeys.secretFieldsKey(config: id),
            "aiplugin.config.\(id.uuidString).secretfields"
        )
        XCTAssertEqual(AIProviderConfigKeys.fieldsKey(config: id), "aiplugin.config.\(id.uuidString).fields")
    }

    func testUniqueNameAppendsSuffix() {
        XCTAssertEqual(AIProviderConfiguration.uniqueName("Groq", avoiding: ["Groq"]), "Groq 2")
        XCTAssertEqual(AIProviderConfiguration.uniqueName("Groq", avoiding: []), "Groq")
    }
}

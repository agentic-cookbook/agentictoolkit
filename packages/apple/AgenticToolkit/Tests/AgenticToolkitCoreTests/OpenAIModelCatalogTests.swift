import Foundation
import Testing
@testable import AgenticToolkitCore

@Suite("OpenAIModelCatalog.parse")
struct OpenAIModelCatalogTests {

    @Test("extracts model ids from an OpenAI /models payload")
    func parsesModelIds() {
        let json = Data("""
        {"object":"list","data":[
            {"id":"llama3.1:8b","object":"model"},
            {"id":"qwen2.5-coder:32b","object":"model"}
        ]}
        """.utf8)
        #expect(OpenAIModelCatalog.parse(json) == ["llama3.1:8b", "qwen2.5-coder:32b"])
    }

    @Test("returns empty for a payload without a data array")
    func handlesMissingData() {
        let json = Data(#"{"error":{"message":"nope"}}"#.utf8)
        #expect(OpenAIModelCatalog.parse(json).isEmpty)
    }

    @Test("skips entries missing an id")
    func skipsEntriesWithoutId() {
        let json = Data(#"{"data":[{"id":"a"},{"object":"model"},{"id":"b"}]}"#.utf8)
        #expect(OpenAIModelCatalog.parse(json) == ["a", "b"])
    }

    @Test("returns empty for non-JSON")
    func handlesGarbage() {
        #expect(OpenAIModelCatalog.parse(Data("not json".utf8)).isEmpty)
    }
}

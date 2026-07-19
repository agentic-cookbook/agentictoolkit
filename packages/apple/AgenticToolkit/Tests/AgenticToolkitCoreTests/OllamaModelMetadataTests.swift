import Foundation
import Testing
@testable import AgenticToolkitCore

@Suite("LocalModelMetadataStore")
struct OllamaModelMetadataTests {

    @Test("parseShow extracts capabilities, details, and context length")
    func parsesShow() {
        let data = Data("""
        {"capabilities":["completion","tools","insert"],
         "details":{"family":"qwen2","parameter_size":"32.8B",\
        "quantization_level":"Q4_K_M"},
         "model_info":{"qwen2.context_length":32768,\
        "qwen2.embedding_length":5120}}
        """.utf8)
        let meta = LocalModelMetadataStore.parseShow(data)
        #expect(meta?.capabilities == ["completion", "tools", "insert"])
        #expect(meta?.parameterSize == "32.8B")
        #expect(meta?.quantization == "Q4_K_M")
        #expect(meta?.contextLength == 32768)
        #expect(meta?.supportsTools == true)
        #expect(meta?.supportsVision == false)
    }

    @Test("parseShow returns nil when nothing useful is present")
    func parsesEmpty() {
        #expect(LocalModelMetadataStore.parseShow(Data("{}".utf8)) == nil)
        #expect(LocalModelMetadataStore.parseShow(Data("not json".utf8)) == nil)
    }

    @Test("nativeOllamaBase strips a trailing /v1 and slashes")
    func derivesNativeBase() {
        let url1 = "http://localhost:11434/v1"
        #expect(LocalModelMetadataStore.nativeOllamaBase(fromOpenAIBase: url1)
                == "http://localhost:11434")
        let url2 = "http://localhost:11434/v1/"
        #expect(LocalModelMetadataStore.nativeOllamaBase(fromOpenAIBase: url2)
                == "http://localhost:11434")
        let url3 = "http://localhost:11434"
        #expect(LocalModelMetadataStore.nativeOllamaBase(fromOpenAIBase: url3)
                == "http://localhost:11434")
    }

    @Test("isLoopback recognizes local hosts only")
    func detectsLoopback() {
        #expect(LocalModelMetadataStore.isLoopback(baseURL: "http://localhost:11434/v1"))
        #expect(LocalModelMetadataStore.isLoopback(baseURL: "http://127.0.0.1:11434/v1"))
        #expect(LocalModelMetadataStore.isLoopback(baseURL: "https://api.openai.com/v1") == false)
    }
}

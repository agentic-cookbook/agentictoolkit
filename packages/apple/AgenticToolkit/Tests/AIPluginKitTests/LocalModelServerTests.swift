import Testing
import Foundation
@testable import AIPluginKit

@Suite("LocalModelServer")
struct LocalModelServerTests {

    @Test("loopback hosts are detected, remote hosts are not")
    func loopbackDetection() {
        #expect(LocalModelServer.isLoopback(baseURL: "http://localhost:11434/v1"))
        #expect(LocalModelServer.isLoopback(baseURL: "http://127.0.0.1:11434/v1"))
        #expect(!LocalModelServer.isLoopback(baseURL: "https://api.anthropic.com/v1"))
        #expect(!LocalModelServer.isLoopback(baseURL: ""))
    }

    @Test("native tags URL strips the /v1 suffix")
    func nativeTagsURLStripsV1Suffix() {
        #expect(LocalModelServer.nativeTagsURL(baseURL: "http://localhost:11434/v1")?.absoluteString
            == "http://localhost:11434/api/tags")
        #expect(LocalModelServer.nativeTagsURL(baseURL: "http://localhost:11434/v1/")?.absoluteString
            == "http://localhost:11434/api/tags")
        #expect(LocalModelServer.nativeTagsURL(baseURL: "http://localhost:11434")?.absoluteString
            == "http://localhost:11434/api/tags")
        #expect(LocalModelServer.nativeTagsURL(baseURL: "") == nil)
    }

    @Test("parseSizes indexes both name and model keys; size(of:) tolerates :latest")
    func parseSizesIndexesNameAndModelKeys() {
        let json = """
        {"models":[
          {"name":"llama3.1:8b","model":"llama3.1:8b","size":4920000000},
          {"name":"qwen3-coder-next:latest","size":51000000000},
          {"name":"broken-no-size"}
        ]}
        """
        let sizes = LocalModelServer.parseSizes(Data(json.utf8))
        #expect(sizes["llama3.1:8b"] == 4_920_000_000)
        #expect(sizes["qwen3-coder-next:latest"] == 51_000_000_000)
        #expect(sizes["broken-no-size"] == nil)
        #expect(LocalModelServer.size(of: "qwen3-coder-next", in: sizes) == 51_000_000_000)
        #expect(LocalModelServer.size(of: "llama3.1:8b", in: sizes) == 4_920_000_000)
    }

    @Test("parseSizes tolerates garbage")
    func parseSizesToleratesGarbage() {
        #expect(LocalModelServer.parseSizes(Data("not json".utf8)) == [:])
    }
}

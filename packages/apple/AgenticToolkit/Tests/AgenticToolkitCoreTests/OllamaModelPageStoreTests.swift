import Foundation
import Testing
@testable import AgenticToolkitCore

@Suite("OllamaModelPageStore")
struct OllamaModelPageStoreTests {

    @Test("pageURL routes official models to /library and strips the tag")
    func libraryURL() {
        #expect(OllamaModelPageStore.pageURL(for: "llama3.2")?.absoluteString
            == "https://ollama.com/library/llama3.2")
        #expect(OllamaModelPageStore.pageURL(for: "deepseek-coder-v2:16b")?.absoluteString
            == "https://ollama.com/library/deepseek-coder-v2")
    }

    @Test("pageURL routes community models to their namespace")
    func communityURL() {
        #expect(OllamaModelPageStore.pageURL(for: "huihui_ai/qwen3.5-abliterated:latest")?.absoluteString
            == "https://ollama.com/huihui_ai/qwen3.5-abliterated")
    }

    @Test("pageURL rejects empty and malformed names")
    func badNames() {
        #expect(OllamaModelPageStore.pageURL(for: "") == nil)
        #expect(OllamaModelPageStore.pageURL(for: ":latest") == nil)
        #expect(OllamaModelPageStore.pageURL(for: "/leading") == nil)
        #expect(OllamaModelPageStore.pageURL(for: "trailing/") == nil)
    }

    @Test("parseDescription prefers og:description and unescapes entities")
    func parsesOG() {
        let html = """
        <head><meta name="description" content="plain one">
        <meta property="og:description" content="Meta&#39;s Llama &amp; friends" /></head>
        """
        #expect(OllamaModelPageStore.parseDescription(html) == "Meta's Llama & friends")
    }

    @Test("parseDescription falls back to the plain description meta")
    func parsesPlain() {
        let html = "<meta name=\"description\" content=\"  An open-source model.  \">"
        #expect(OllamaModelPageStore.parseDescription(html) == "An open-source model.")
    }

    @Test("parseDescription returns nil when nothing useful is present")
    func parsesEmpty() {
        #expect(OllamaModelPageStore.parseDescription("<html></html>") == nil)
        #expect(OllamaModelPageStore.parseDescription(
            "<meta property=\"og:description\" content=\"\">") == nil)
    }

    @Test("parseStats reads the downloads and updated spans")
    func parsesStats() {
        let html = """
        <span >117.4M</span>
        <span class="hidden sm:flex">&nbsp;Downloads</span>
        <span class="hidden sm:flex">Updated&nbsp;</span>
        <span >1 year ago</span>
        """
        let stats = OllamaModelPageStore.parseStats(html)
        #expect(stats.downloads == "117.4M")
        #expect(stats.updated == "1 year ago")
    }

    @Test("parseStats degrades to nils when the markup is absent")
    func parsesStatsEmpty() {
        let stats = OllamaModelPageStore.parseStats("<html></html>")
        #expect(stats.downloads == nil)
        #expect(stats.updated == nil)
    }
}

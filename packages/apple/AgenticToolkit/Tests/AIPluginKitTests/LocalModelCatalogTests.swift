import Testing
import Foundation
@testable import AIPluginKit

@Suite("LocalModelCatalog")
struct LocalModelCatalogTests {
    private static let tagsJSON = Data("""
        {"models":[{"name":"small:latest","size":4900000000}]}
        """.utf8)

    @Test("fetches /api/tags once, parses, and serves the cache")
    func fetchesParsesAndCachesPerBaseURL() async {
        let counter = FetchCounter()
        let catalog = LocalModelCatalog(fetcher: { url in
            #expect(url.absoluteString == "http://localhost:11434/api/tags")
            await counter.increment()
            return Self.tagsJSON
        })
        let first = await catalog.sizeBytes(model: "small:latest", baseURL: "http://localhost:11434/v1")
        #expect(first == 4_900_000_000)
        // `:latest` shorthand, served from cache — no second fetch
        let second = await catalog.sizeBytes(model: "small", baseURL: "http://localhost:11434/v1")
        #expect(second == 4_900_000_000)
        #expect(await counter.value == 1)
    }

    @Test("a failed fetch returns nil and is not retried within the failure TTL")
    func failureReturnsNilAndIsNotHammered() async {
        let counter = FetchCounter()
        let catalog = LocalModelCatalog(fetcher: { _ in
            await counter.increment()
            throw URLError(.cannotConnectToHost)
        })
        let firstResult = await catalog.sizeBytes(model: "m", baseURL: "http://localhost:11434/v1")
        let secondResult = await catalog.sizeBytes(model: "m", baseURL: "http://localhost:11434/v1")
        #expect(firstResult == nil)
        #expect(secondResult == nil)
        #expect(await counter.value == 1)
    }

    @Test("a model the server doesn't list has no size")
    func unknownModelReturnsNil() async {
        let catalog = LocalModelCatalog(fetcher: { _ in Self.tagsJSON })
        let size = await catalog.sizeBytes(model: "other", baseURL: "http://localhost:11434/v1")
        #expect(size == nil)
    }
}

private actor FetchCounter {
    var value = 0
    func increment() { value += 1 }
}

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

    @Test("a failed refetch keeps the last known-good sizes, on the failure cadence")
    func failedRefetchKeepsKnownSizes() async {
        let base = "http://localhost:11434/v1"
        let counter = FetchCounter()
        // First fetch succeeds; every refetch fails. successTTL 0 forces an
        // immediate refetch; failureTTL is long so the failure entry is served.
        let catalog = LocalModelCatalog(
            fetcher: { _ in
                if await counter.increment() == 1 { return Self.tagsJSON }
                throw URLError(.cannotConnectToHost)
            },
            successTTL: 0, failureTTL: 3600)
        let seeded = await catalog.sizeBytes(model: "small:latest", baseURL: base)
        #expect(seeded == 4_900_000_000)
        // The expired entry is refetched and the fetch FAILS: the known size must
        // survive — failing open here would run a model known to be over budget.
        let afterFailure = await catalog.sizeBytes(model: "small:latest", baseURL: base)
        #expect(afterFailure == 4_900_000_000)
        #expect(await counter.value == 2)
        // Within the failure TTL nothing is re-fetched, and the size still serves.
        let cached = await catalog.sizeBytes(model: "small:latest", baseURL: base)
        #expect(cached == 4_900_000_000)
        #expect(await counter.value == 2)
    }
}

private actor FetchCounter {
    var value = 0
    @discardableResult
    func increment() -> Int {
        value += 1
        return value
    }
}

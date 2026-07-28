import Foundation
import Testing
@testable import AIPluginKit

@Suite("ProviderTypeFacet")
struct ProviderTypeFacetTests {

    @Test("buckets the config-type strings the descriptors actually ship")
    func realConfigTypes() {
        #expect(ProviderTypeFacet(configType: "OAuth Account") == .subscription)
        #expect(ProviderTypeFacet(configType: "Subscription") == .subscription)
        #expect(ProviderTypeFacet(configType: "API Key") == .apiKey)
        #expect(ProviderTypeFacet(configType: "Local") == .local)
        #expect(ProviderTypeFacet(configType: "Local Server") == .local)
    }

    @Test("matching is loose and case-insensitive, so new wording lands in its bucket")
    func looseMatching() {
        #expect(ProviderTypeFacet(configType: "oauth 2 account") == .subscription)
        #expect(ProviderTypeFacet(configType: "Access Token") == .apiKey)
        #expect(ProviderTypeFacet(configType: "") == .custom)
        #expect(ProviderTypeFacet(configType: "Bring your own endpoint") == .custom)
    }

    @Test("an account beats a key when the string mentions both")
    func subscriptionWinsOverKey() {
        // "OAuth Account" style strings sometimes also say "token"; the account is
        // the thing the user needs, so it takes precedence.
        #expect(ProviderTypeFacet(configType: "Subscription Token") == .subscription)
    }

    @Test("an empty selection filters nothing; otherwise it is exact")
    func matches() {
        #expect(ProviderTypeFacet.matches(type: .apiKey, selected: []))
        #expect(ProviderTypeFacet.matches(type: .apiKey, selected: [.apiKey, .local]))
        #expect(ProviderTypeFacet.matches(type: .subscription, selected: [.apiKey, .local]) == false)
    }

    @Test("every facet has a title and a tooltip")
    func labels() {
        for facet in ProviderTypeFacet.allCases {
            #expect(!facet.title.isEmpty)
            #expect(!facet.detail.isEmpty)
        }
    }
}

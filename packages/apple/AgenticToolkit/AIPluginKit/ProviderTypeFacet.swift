import Foundation

/// How a provider gets used — what it costs you to add it, in setup rather than
/// tokens. The picker's Config Type column already states this per row; this is
/// the same fact bucketed so it can be filtered on.
///
/// The buckets answer "what do I need before this works": an account I already pay
/// for, a key I have to go get, or a server on this machine.
public enum ProviderTypeFacet: String, CaseIterable, Sendable, Codable {
    /// Signed in with an existing subscription or account — no key to paste
    /// (Claude Code's local CLI, an OAuth login).
    case subscription
    /// Needs an API key from the vendor, and bills per token.
    case apiKey
    /// A model server running on this machine (Ollama, LM Studio, LiteLLM).
    case local
    /// A hand-configured endpoint — whatever the user points it at.
    case custom

    public var title: String {
        switch self {
        case .subscription: return "Subscription"
        case .apiKey: return "API key"
        case .local: return "Local LLM"
        case .custom: return "Custom"
        }
    }

    public var detail: String {
        switch self {
        case .subscription: return "Uses an account you already have"
        case .apiKey: return "Needs a key from the vendor"
        case .local: return "Runs on this machine"
        case .custom: return "An endpoint you configure yourself"
        }
    }

    /// Bucket a descriptor's Config Type string.
    ///
    /// Matched loosely on purpose: `configType` is descriptor copy meant to be read
    /// by a person ("OAuth Account", "Subscription Token"), and a vendor adding
    /// "OAuth 2 Account" tomorrow should land in the same bucket rather than
    /// silently becoming a fourth kind of thing.
    public init(configType: String) {
        let text = configType.lowercased()
        if text.contains("oauth") || text.contains("subscription") || text.contains("account") {
            self = .subscription
        } else if text.contains("local") {
            self = .local
        } else if text.contains("key") || text.contains("token") {
            self = .apiKey
        } else {
            self = .custom
        }
    }

    /// Does a provider of this type survive a filter on `selected`? An empty
    /// selection filters nothing.
    public static func matches(type: ProviderTypeFacet, selected: Set<ProviderTypeFacet>) -> Bool {
        selected.isEmpty || selected.contains(type)
    }
}

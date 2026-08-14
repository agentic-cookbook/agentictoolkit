import Foundation

/// A capability a model either has or doesn't — the yes/no axis, as opposed to
/// `ModelUseFacet`'s "what is it good for".
///
/// Three of the four are hard capabilities the serving gateway asserts (`tools`,
/// `reasoning`, `vision` — the only three `AIModelCatalog.Model.capabilities` ever
/// carries). The fourth, `conversation`, has no gateway flag anywhere and is read
/// out of the model's prose via `ModelUseFacet`, which is exactly the heuristic the
/// "Good for" filter already runs; folding it in here keeps one derivation rather
/// than two that can disagree.
///
/// Exists so a table can render one column per capability with a check mark, which
/// a badge string ("Tools · Reasoning") can't be scanned as down a column.
public enum ModelCapability: String, CaseIterable, Sendable, Codable {
    case tools
    case reasoning
    case vision
    case conversation

    /// Column header / badge label. Short, because these are column headers over a
    /// check mark and the column is only as wide as its title.
    public var title: String {
        switch self {
        case .tools: return "Tools"
        case .reasoning: return "Reasoning"
        case .vision: return "Vision"
        case .conversation: return "Chat"
        }
    }

    /// Tooltip copy for the column header.
    public var detail: String {
        switch self {
        case .tools: return "Calls tools / functions you supply"
        case .reasoning: return "Thinks step by step before answering"
        case .vision: return "Accepts images as input"
        case .conversation: return "Built for chat, assistants and personas"
        }
    }

    /// The gateway-reported capability string this case corresponds to, when there
    /// is one. `conversation` has none — see the type's note.
    private var reportedName: String? {
        switch self {
        case .tools: return "tools"
        case .reasoning: return "reasoning"
        case .vision: return "vision"
        case .conversation: return nil
        }
    }

    /// Does `info` have this capability?
    ///
    /// A curated `tools == true` counts for `.tools` even when the gateway reported
    /// no capability list at all — that flag is the only evidence most curated
    /// `modelDetails` entries carry, and dropping it would blank the column for
    /// every provider that ships its own model copy.
    public static func has(_ capability: ModelCapability, _ info: AIModelCatalog.ResolvedModel) -> Bool {
        if let name = capability.reportedName, info.capabilities.contains(name) { return true }
        switch capability {
        case .tools: return info.tools == true
        case .conversation: return ModelUseFacet.facets(for: info).contains(.conversation)
        case .reasoning, .vision: return false
        }
    }

    /// Every capability `info` has, in `allCases` order.
    public static func capabilities(of info: AIModelCatalog.ResolvedModel) -> [ModelCapability] {
        allCases.filter { has($0, info) }
    }
}

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

    /// Every capability string a gateway might report for this case. More than one
    /// spelling because the string is whatever the serving gateway chose to call it
    /// and no two agree: OpenAI-shaped servers report `function_calling`, Google
    /// reports `functionCalling`, and reasoning arrives as `thinking` about as often
    /// as `reasoning`. Matching only the toolkit's own spelling silently blanked the
    /// column for every provider that spells it differently.
    ///
    /// `conversation` answers to none of them — see the type's note.
    private var reportedNames: [String] {
        switch self {
        case .tools: return ["tools", "tool_use", "tool-use", "function_calling", "functioncalling",
                             "function-calling", "functions"]
        case .reasoning: return ["reasoning", "thinking", "extended_thinking", "extended-thinking"]
        case .vision: return ["vision", "image", "images", "image_input", "multimodal"]
        case .conversation: return []
        }
    }

    /// Is this capability among the strings a gateway reported? Case-insensitive,
    /// because the spelling is the gateway's, not ours.
    ///
    /// Public so the one vocabulary serves every reader of a reported capability
    /// list — `ModelUseFacet.impliedByCapability` included, which used to carry its
    /// own literal `"tools"` / `"vision"` / `"reasoning"` and so disagreed with this
    /// table for any gateway that spells them differently.
    public static func reports(_ capability: ModelCapability, in capabilities: [String]) -> Bool {
        let names = Set(capability.reportedNames)
        return capabilities.contains { names.contains($0.lowercased()) }
    }

    /// Did the gateway report this capability for `info`?
    public static func reports(_ capability: ModelCapability,
                               _ info: AIModelCatalog.ResolvedModel) -> Bool {
        reports(capability, in: info.capabilities)
    }

    /// Does `info` have this capability?
    ///
    /// A curated `tools == true` counts for `.tools` even when the gateway reported
    /// no capability list at all — that flag is the only evidence most curated
    /// `modelDetails` entries carry, and dropping it would blank the column for
    /// every provider that ships its own model copy.
    ///
    /// `extraText` carries description text the catalog doesn't have — a local
    /// server's fetched blurb, say — and is the only evidence `.conversation` can
    /// have for a model no catalog has heard of. `.reasoning` and `.vision` stay
    /// hard-false without a gateway report on purpose: prose saying a model "reasons
    /// well" is marketing, not the asserted capability the check-mark column claims.
    public static func has(_ capability: ModelCapability,
                           _ info: AIModelCatalog.ResolvedModel,
                           extraText: String? = nil) -> Bool {
        if reports(capability, info) { return true }
        switch capability {
        case .tools: return info.tools == true
        case .conversation:
            return ModelUseFacet.facets(for: info, extraText: extraText).contains(.conversation)
        case .reasoning, .vision: return false
        }
    }

    /// Every capability `info` has, in `allCases` order.
    public static func capabilities(of info: AIModelCatalog.ResolvedModel,
                                    extraText: String? = nil) -> [ModelCapability] {
        allCases.filter { has($0, info, extraText: extraText) }
    }
}

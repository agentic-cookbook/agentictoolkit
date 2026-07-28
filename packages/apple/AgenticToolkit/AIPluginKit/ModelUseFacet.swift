import Foundation

/// What a model is *good for* — the axis people actually pick a model on, and the
/// one the catalog does not carry.
///
/// Gateways report three hard capabilities (`tools`, `reasoning`, `vision`) and a
/// sentence of prose. Neither answers "which of these writes code well"; the prose
/// does, but only if something reads it. So the facets are derived from the text
/// (plus the hard capabilities, which are evidence for three of them) rather than
/// stored — derived, because the text arrives from three places at three different
/// times: the shared catalog, a template's curated `modelDetails`, and, for a local
/// server, a blurb fetched from ollama.com for a model no catalog has ever heard of.
/// Baking the answer into `model-catalog.json` would serve only the first.
///
/// Keyword matching is a heuristic and is treated as one: a facet says *some*
/// evidence was found, never that its absence means the model is bad at the job.
/// A model with no evidence at all has an empty set, and callers are expected to
/// let those through a filter rather than hide them (see `matches`).
public enum ModelUseFacet: String, CaseIterable, Sendable, Codable {
    case coding
    case conversation
    case problemSolving
    case research
    case writing
    case vision
    case agents
    case translation
    case speech
    case economy

    /// Menu/checkbox label.
    public var title: String {
        switch self {
        case .coding: return "Coding"
        case .conversation: return "Conversation"
        case .problemSolving: return "Problem solving"
        case .research: return "Research"
        case .writing: return "Writing"
        case .vision: return "Vision"
        case .agents: return "Agents & tools"
        case .translation: return "Translation"
        case .speech: return "Speech & audio"
        case .economy: return "Fast & low cost"
        }
    }

    /// A word or two on what the facet covers, for the menu item's tooltip.
    public var detail: String {
        switch self {
        case .coding: return "Writing, reviewing and debugging code"
        case .conversation: return "Chat, assistants and personas"
        case .problemSolving: return "Reasoning, math and step-by-step work"
        case .research: return "Long documents, analysis and retrieval"
        case .writing: return "Drafting, editing and creative text"
        case .vision: return "Images, screenshots, charts and video"
        case .agents: return "Tool calling and long-horizon workflows"
        case .translation: return "Multilingual work and translation"
        case .speech: return "Transcription, speech and audio"
        case .economy: return "Fast, cheap, high-volume work"
        }
    }

    // MARK: - Derivation

    /// Token prefixes, matched against whole words of the model's text. Prefixes
    /// rather than exact words so one entry covers a family ("summar" →
    /// summarize/summarization); anchored at the word start so "encoded" is not
    /// coding evidence.
    private var wordPrefixes: [String] {
        switch self {
        case .coding: return ["cod", "developer", "programm", "software", "swe", "repositor", "debug"]
        case .conversation: return ["chat", "conversation", "assistant", "dialog", "persona", "roleplay",
                                    "companion", "instruct"]
        case .problemSolving: return ["reason", "math", "logic", "problem", "thinking", "stem", "science"]
        case .research: return ["research", "document", "analysis", "analyz", "retriev", "summar", "search"]
        case .writing: return ["writ", "creative", "copywriting", "storytell", "draft", "editing", "prose"]
        case .vision: return ["vision", "visual", "multimodal", "ocr", "video", "chart", "screenshot", "image"]
        case .agents: return ["agent", "agentic", "tool", "orchestrat", "workflow", "autonom"]
        case .translation: return ["translat", "multiling", "localization"]
        case .speech: return ["audio", "speech", "transcri", "voice", "tts", "asr"]
        case .economy: return ["fast", "efficient", "lightweight", "cheap", "inexpensive"]
        }
    }

    /// Phrases matched against the raw text, for evidence that spans words or
    /// hyphens and so never survives tokenising.
    private var phrases: [String] {
        switch self {
        case .coding: return ["code generation"]
        case .conversation: return []
        case .problemSolving: return ["step-by-step", "step by step"]
        case .research: return ["long context", "long-context", "long documents", "deep research"]
        case .writing: return ["text generation", "content creation"]
        case .vision: return ["vision-language", "document understanding"]
        case .agents: return ["function calling", "tool use", "long-horizon", "long horizon"]
        case .translation: return ["language pairs", "cross-language"]
        case .speech: return ["text-to-speech", "speech-to-text"]
        case .economy: return ["low cost", "low-cost", "high volume", "high-volume", "cost-effective",
                               "cost effective", "high throughput", "high-throughput"]
        }
    }

    /// The hard capability a gateway can report that is direct evidence for this
    /// facet — stronger than any wording, since the serving gateway asserts it.
    private var impliedByCapability: String? {
        switch self {
        case .agents: return "tools"
        case .vision: return "vision"
        case .problemSolving: return "reasoning"
        default: return nil
        }
    }

    /// Every facet supported by a model's own text and reported capabilities.
    ///
    /// `extraText` carries description text the catalog doesn't have — a local
    /// server's ollama.com blurb, say — so a live-fetched model the catalog has
    /// never seen still earns facets.
    ///
    /// The model's *id* is deliberately not evidence. Names are marketing, not
    /// description: `-instruct` and `-chat` are a training-recipe suffix on most of
    /// the catalog rather than a claim about conversation, and `claude-opus-5-fast`
    /// would land the flagship model under "Economy". A model with no prose earns no
    /// facets and stays visible anyway — see `matches`.
    public static func facets(
        for model: AIModelCatalog.ResolvedModel, extraText: String? = nil
    ) -> Set<ModelUseFacet> {
        facets(text: [model.description, model.goodFor, extraText]
            .compactMap { $0 }.joined(separator: " "),
               capabilities: model.capabilities)
    }

    /// The pure core: facets supported by one blob of text plus reported capabilities.
    public static func facets(text: String, capabilities: [String] = []) -> Set<ModelUseFacet> {
        let lowered = text.lowercased()
        let words = lowered.split(whereSeparator: { !$0.isLetter && !$0.isNumber })
        var found: Set<ModelUseFacet> = []
        for facet in ModelUseFacet.allCases {
            if let capability = facet.impliedByCapability, capabilities.contains(capability) {
                found.insert(facet)
                continue
            }
            let prefixes = facet.wordPrefixes
            if words.contains(where: { word in prefixes.contains { word.hasPrefix($0) } }) {
                found.insert(facet)
                continue
            }
            if facet.phrases.contains(where: lowered.contains) { found.insert(facet) }
        }
        return found
    }

    /// Does a model with these facets survive a filter on `selected`?
    ///
    /// Any of the selected facets is enough — "good for coding *or* writing" is how
    /// a check-several-boxes filter reads, and requiring all of them empties the
    /// list on the second box. An empty selection filters nothing.
    ///
    /// A model we know *nothing* about always passes: the facets are read out of
    /// prose, and no prose means no evidence either way. Hiding a model because its
    /// gateway shipped no description would quietly remove the very model the user
    /// came to select — including, on a local server, every model at once.
    public static func matches(facets: Set<ModelUseFacet>, selected: Set<ModelUseFacet>) -> Bool {
        if selected.isEmpty || facets.isEmpty { return true }
        return !facets.isDisjoint(with: selected)
    }
}

import Foundation

public enum AIProvider: String, CaseIterable, Identifiable, Sendable {
    case anthropic
    case openai
    case google
    case custom

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .anthropic: return "Anthropic (Claude)"
        case .openai: return "OpenAI (ChatGPT)"
        case .google: return "Google (Gemini)"
        case .custom: return "Custom (OpenAI-compatible)"
        }
    }

    public var defaultModels: [String] {
        switch self {
        case .anthropic: return ["claude-haiku-4-5-20251001", "claude-sonnet-4-5-20250514", "claude-opus-4-5-20250514"]
        case .openai: return ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-4o-mini", "gpt-4o"]
        case .google: return ["gemini-2.0-flash", "gemini-2.5-flash-preview-05-20", "gemini-2.5-pro-preview-05-06"]
        case .custom: return []
        }
    }

    public var recommendedModel: String {
        switch self {
        case .anthropic: return "claude-haiku-4-5-20251001"
        case .openai: return "gpt-4.1-nano"
        case .google: return "gemini-2.0-flash"
        case .custom: return ""
        }
    }

    public var recommendedNote: String {
        switch self {
        case .anthropic: return "Haiku 4.5 — fast and inexpensive (~$0.80/M input tokens)"
        case .openai: return "GPT-4.1 Nano — cheapest OpenAI model (~$0.10/M input tokens)"
        case .google: return "Gemini 2.0 Flash — fast, free tier available"
        case .custom: return ""
        }
    }

    public var apiKeyPlaceholder: String {
        switch self {
        case .anthropic: return "sk-ant-..."
        case .openai: return "sk-..."
        case .google: return "AIza..."
        case .custom: return "API key"
        }
    }

    public var defaultBaseURL: String {
        switch self {
        case .anthropic: return "https://api.anthropic.com"
        case .openai: return "https://api.openai.com"
        case .google: return "https://generativelanguage.googleapis.com"
        case .custom: return ""
        }
    }
}

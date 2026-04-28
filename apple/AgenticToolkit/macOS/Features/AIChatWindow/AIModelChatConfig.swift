//
//  AIInfo.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/27/26.
//
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

public struct AIModelChatConfig {
    public let aiProvider: AIProvider
    public let aiModel: String
    public let aiBaseURL: String
    public let apiKey: String
    public let aiSummariesEnabled: Bool
    
    public init(aiProvider: AIProvider, aiModel: String, aiBaseURL: String, apiKey: String, aiSummariesEnabled: Bool) {
        self.aiProvider = aiProvider
        self.aiModel = aiModel
        self.aiBaseURL = aiBaseURL
        self.apiKey = apiKey
        self.aiSummariesEnabled = aiSummariesEnabled
    }
}

extension UserSettings {
    
    /// AI provider raw value: "anthropic" / "openai" / "google" / "custom".
    public static var aiProvider = UserSetting<String>("ai_provider", default: "anthropic")
    
    /// AI model identifier; empty string means "use the provider's recommended default".
    public static var aiModel = UserSetting<String>("ai_model", default: "")
    
    /// Optional override base URL for the AI provider's API. Empty means "use the default".
    public static var aiBaseURL = UserSetting<String>("ai_base_url", default: "")
    
    /// AI provider API key. Stored in the secure provider (Keychain).
    public static var aiAPIKey = UserSetting<String>("ai_api_key", default: "", isSecure: true)
    
    /// Whether AI-powered session summaries are enabled.
    public static var aiSummariesEnabled = UserSetting<Bool>("ai_summaries_enabled", default: false)
}

//
//  SettingsKeys+AgenticToolkit.swift
//  AgenticToolkit
//
//  Typed `StoredSetting<...>.Key` extensions for AgenticToolkit-side settings
//  (shared between the AgenticToolkitApp test bench and consumer apps like Whippet).
//
import Foundation
import AgenticToolkitCore

// MARK: - AI / Summarizer settings

extension UserSettings {
    
    /// AI provider raw value: "anthropic" / "openai" / "google" / "custom".
    public static var aiProvider = UserSetting<String>("ai_provider", default: "anthropic")
    
    /// AI model identifier; empty string means "use the provider's recommended default".
    public static var aiModel = UserSetting<String>("ai_model", default: "")
    
    /// Optional override base URL for the AI provider's API. Empty means "use the default".
    public static var aiBaseURL = UserSetting<String>("ai_base_url", default: "")
    
    /// AI provider API key. Stored in the secure provider (Keychain).
    public static var aiAPIKey = UserSetting<String>("ai_api_key", default: "", isSecure: true)
    
    /// Raw value of the configured `SessionWatcherClickAction` for session list clicks.
    public static var clickAction = UserSetting<String>("click_action", default: "openTerminal")
    
    /// Custom command template (shell expression) used by the custom-command click action.
    public static var customCommandTemplate = UserSetting<String>("custom_command_template", default: "")
    
    /// Whether AI-powered session summaries are enabled.
    public static var aiSummariesEnabled = UserSetting<Bool>("ai_summaries_enabled", default: false)
    
    /// Seconds of inactivity before a session is marked stale by the liveness monitor.
    public static var stalenessTimeout = UserSetting<Double>("staleness_timeout", default: 300.0)
    
}

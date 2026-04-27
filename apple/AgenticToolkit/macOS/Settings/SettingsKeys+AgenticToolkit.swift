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

public extension StoredSetting.Key where Value == String {
    /// AI provider raw value: "anthropic" / "openai" / "google" / "custom".
    static var aiProvider: StoredSettingKey<String> {
        .init("ai_provider", default: "anthropic")
    }

    /// AI model identifier; empty string means "use the provider's recommended default".
    static var aiModel: StoredSettingKey<String> {
        .init("ai_model", default: "")
    }

    /// Optional override base URL for the AI provider's API. Empty means "use the default".
    static var aiBaseURL: StoredSettingKey<String> {
        .init("ai_base_url", default: "")
    }

    /// AI provider API key. Stored in the secure provider (Keychain).
    static var aiAPIKey: StoredSettingKey<String> {
        .init("ai_api_key", default: "", isSecure: true)
    }

    /// Raw value of the configured `SessionWatcherClickAction` for session list clicks.
    static var clickAction: StoredSettingKey<String> {
        .init("click_action", default: "openTerminal")
    }

    /// Custom command template (shell expression) used by the custom-command click action.
    static var customCommandTemplate: StoredSettingKey<String> {
        .init("custom_command_template", default: "")
    }
}

public extension StoredSetting.Key where Value == Bool {
    /// Whether AI-powered session summaries are enabled.
    static var aiSummariesEnabled: any StorableSetting<Value> {
        .init("ai_summaries_enabled", default: false)
    }
}

public extension StoredSetting.Key where Value == Int {
    /// Seconds of inactivity before a session is marked stale by the liveness monitor.
    static var stalenessTimeout: StoredSetting<Int>.Key {
        .init("staleness_timeout", default: 300)
    }
}

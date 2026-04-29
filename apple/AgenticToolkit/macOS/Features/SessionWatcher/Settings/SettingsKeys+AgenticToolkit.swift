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

    /// Raw value of the configured `SessionWatcherClickAction` for session list clicks.
    public static var clickAction = UserSetting<String>("click_action", default: "openTerminal")
    
    /// Custom command template (shell expression) used by the custom-command click action.
    public static var customCommandTemplate = UserSetting<String>("custom_command_template", default: "")
    
    /// Seconds of inactivity before a session is marked stale by the liveness monitor.
    public static var stalenessTimeout = UserSetting<Double>("staleness_timeout", default: 300.0)
    
    /// Whether the session panel floats above all other windows.
    static public var alwaysOnTop = UserSetting<Bool>("always_on_top", default: true)
}

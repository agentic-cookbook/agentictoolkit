import Foundation
import Combine
import os
import AgenticPluginSDK

/// Persistence delegate for AI settings. Implement this to back the settings
/// with any storage (UserDefaults, SQLite, etc.).
@MainActor
public protocol AISettingsPersistence: AnyObject {
    func loadSetting(key: String) -> String?
    func saveSetting(key: String, value: String)
}

/// The state of an API key validation test.
public enum APIKeyTestState: Equatable {
    case idle
    case testing
    case success
    case failed(String)
}

/// Provides the current plugin configuration to the chat view model.
@MainActor
public protocol ChatConfigProvider: AnyObject {
    var selectedPluginIdentifier: String { get }
    var selectedModel: String { get }
    var pluginCredentials: PluginCredentials { get }
}

/// View model for the AI/LLM settings panel.
///
/// Manages plugin selection, model selection, API key storage, and credential
/// validation. Decoupled from any specific storage backend via `AISettingsPersistence`.
@MainActor
public final class AISettingsViewModel: ObservableObject, ChatConfigProvider {

    // MARK: - Settings Keys

    public static let pluginKey = "ai_plugin_identifier"
    public static let modelKey = "ai_model"
    public static let apiKeyKeychainKey = "ai_api_key"
    public static let baseURLKey = "ai_base_url"
    public static let enabledKey = "ai_summaries_enabled"

    // MARK: - Published Properties

    @Published public var selectedPluginIdentifier: String {
        didSet {
            guard !isLoading else { return }
            persistence?.saveSetting(key: Self.pluginKey, value: selectedPluginIdentifier)
            apiKeyTestState = .idle
            // Reset model to the plugin's recommended when switching
            if let plugin = try? pluginManager.loadPlugin(identifier: selectedPluginIdentifier) {
                if !plugin.availableModels.contains(selectedModel) {
                    selectedModel = plugin.recommendedModel
                }
            }
        }
    }

    @Published public var selectedModel: String {
        didSet {
            guard !isLoading else { return }
            persistence?.saveSetting(key: Self.modelKey, value: selectedModel)
        }
    }

    @Published public var apiKey: String = "" {
        didSet {
            guard !isLoading else { return }
            if !apiKey.isEmpty {
                KeychainHelper.set(apiKey, forKey: Self.apiKeyKeychainKey)
                hasStoredAPIKey = true
                if !isEnabled { isEnabled = true }
            }
            apiKeyTestState = .idle
        }
    }

    @Published public var hasStoredAPIKey: Bool = false

    @Published public var baseURL: String = "" {
        didSet {
            guard !isLoading else { return }
            persistence?.saveSetting(key: Self.baseURLKey, value: baseURL)
        }
    }

    @Published public var isEnabled: Bool = false {
        didSet {
            guard !isLoading else { return }
            persistence?.saveSetting(key: Self.enabledKey, value: isEnabled ? "true" : "false")
        }
    }

    @Published public var apiKeyTestState: APIKeyTestState = .idle

    // MARK: - Properties

    public let pluginManager: PluginManager
    private weak var persistence: AISettingsPersistence?
    private var isLoading = true

    private let logger = Logger(subsystem: "com.agenticplugins", category: "AISettings")

    // MARK: - ChatConfigProvider

    public var pluginCredentials: PluginCredentials {
        let key = apiKey.isEmpty ? (KeychainHelper.get(forKey: Self.apiKeyKeychainKey) ?? "") : apiKey
        return PluginCredentials(apiKey: key, baseURL: baseURL.isEmpty ? nil : baseURL)
    }

    // MARK: - Initialization

    public init(pluginManager: PluginManager, persistence: AISettingsPersistence? = nil) {
        self.pluginManager = pluginManager
        self.persistence = persistence

        // Defaults
        self.selectedPluginIdentifier = ""
        self.selectedModel = ""

        loadFromPersistence()
        isLoading = false
    }

    // MARK: - Load

    private func loadFromPersistence() {
        if let id = persistence?.loadSetting(key: Self.pluginKey), !id.isEmpty {
            selectedPluginIdentifier = id
        } else if let first = pluginManager.availablePlugins.first {
            selectedPluginIdentifier = first.identifier
        }

        if let model = persistence?.loadSetting(key: Self.modelKey), !model.isEmpty {
            selectedModel = model
        } else if let plugin = try? pluginManager.loadPlugin(identifier: selectedPluginIdentifier) {
            selectedModel = plugin.recommendedModel
        }

        if let url = persistence?.loadSetting(key: Self.baseURLKey) {
            baseURL = url
        }

        if let enabled = persistence?.loadSetting(key: Self.enabledKey) {
            isEnabled = enabled == "true"
        }

        hasStoredAPIKey = KeychainHelper.exists(forKey: Self.apiKeyKeychainKey)
    }

    // MARK: - Actions

    /// Deletes the stored API key.
    public func clearAPIKey() {
        KeychainHelper.delete(forKey: Self.apiKeyKeychainKey)
        hasStoredAPIKey = false
        apiKey = ""
        apiKeyTestState = .idle
    }

    /// Validates the current API key by calling the plugin's validation method.
    public func testAPIKey() {
        let key = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let storedKey = key.isEmpty ? (KeychainHelper.get(forKey: Self.apiKeyKeychainKey) ?? "") : key
        guard !storedKey.isEmpty else {
            apiKeyTestState = .failed("No API key entered")
            return
        }

        apiKeyTestState = .testing

        let pluginId = selectedPluginIdentifier
        let creds = PluginCredentials(apiKey: storedKey, baseURL: baseURL.isEmpty ? nil : baseURL)

        Task { [weak self] in
            guard let self else { return }
            guard let plugin = try? self.pluginManager.loadPlugin(identifier: pluginId) else {
                self.apiKeyTestState = .failed("Plugin not available")
                return
            }

            let error = await plugin.validateCredentials(creds)
            if let error {
                self.apiKeyTestState = .failed(error)
            } else {
                self.apiKeyTestState = .success
            }
        }
    }

    /// Returns the currently selected plugin's available models.
    public var availableModels: [String] {
        guard let plugin = try? pluginManager.loadPlugin(identifier: selectedPluginIdentifier) else {
            return []
        }
        return plugin.availableModels
    }

    /// Whether the currently selected plugin requires an API key.
    public var requiresAPIKey: Bool {
        guard let plugin = try? pluginManager.loadPlugin(identifier: selectedPluginIdentifier) else {
            return true
        }
        return plugin.requiresAPIKey
    }
}

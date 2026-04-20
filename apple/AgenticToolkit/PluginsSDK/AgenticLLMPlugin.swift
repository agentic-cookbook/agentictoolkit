import AppKit
import AgenticAppKit

/// Protocol that all LLM provider plugins must conform to.
///
/// Each plugin is a compiled macOS `.bundle` with an `NSPrincipalClass` that
/// conforms to this protocol. The plugin manager discovers bundles by reading
/// their `Info.plist` metadata and only loads the binary when the plugin is
/// first used.
public protocol AgenticLLMPlugin: AnyObject, Sendable {

    /// Unique reverse-DNS identifier (e.g. "com.agentictoolkit.plugin.anthropic").
    /// Must match the `AgenticPluginIdentifier` in the bundle's Info.plist.
    static var identifier: String { get }

    /// Human-readable name shown in the UI.
    var displayName: String { get }

    /// Capability flags this plugin supports.
    var capabilities: PluginCapability { get }

    /// Available models, ordered cheapest first.
    var availableModels: [String] { get }

    /// The recommended model for cheap/fast tasks like summarization.
    var recommendedModel: String { get }

    /// Whether this plugin requires an API key to function.
    var requiresAPIKey: Bool { get }

    /// Initialize with a context providing a logger and data directory.
    init(context: PluginContext)

    /// Send messages and receive a response as a stream.
    ///
    /// Streaming plugins yield chunks as they arrive. Non-streaming plugins
    /// yield a single result and finish. Callers should concatenate all chunks.
    func sendMessages(
        _ messages: [LLMMessage],
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        credentials: PluginCredentials
    ) -> AsyncThrowingStream<String, Error>

    /// Optional: provide a settings panel view controller for this plugin.
    /// The returned controller is hosted in the app's `SettingsViewController`
    /// sidebar; return nil for plugins that have no per-plugin settings UI.
    @MainActor
    func settingsPanelViewController() -> (any SettingsPanelViewController)?

    /// Validate credentials by making a minimal API call.
    /// Returns nil on success, or an error message string on failure.
    func validateCredentials(_ credentials: PluginCredentials) async -> String?
}

// MARK: - Default Implementations

public extension AgenticLLMPlugin {
    @MainActor
    func settingsPanelViewController() -> (any SettingsPanelViewController)? { nil }
    func validateCredentials(_ credentials: PluginCredentials) async -> String? { nil }
}

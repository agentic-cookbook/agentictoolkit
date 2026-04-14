import AppKit

/// Protocol that all LLM provider plugins must conform to.
///
/// Each plugin is a compiled macOS `.bundle` with an `NSPrincipalClass` that
/// conforms to this protocol. The plugin manager discovers bundles by reading
/// their `Info.plist` metadata and only loads the binary when the plugin is
/// first used.
public protocol AgenticLLMPlugin: AnyObject, Sendable {

    /// Unique reverse-DNS identifier (e.g. "com.agenticplugins.plugin.anthropic").
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

    /// Optional: provide a custom NSView for plugin-specific settings
    /// (e.g. a base URL field for OpenAI-compatible endpoints).
    func settingsView() -> NSView?

    /// Validate credentials by making a minimal API call.
    /// Returns nil on success, or an error message string on failure.
    func validateCredentials(_ credentials: PluginCredentials) async -> String?
}

// MARK: - Default Implementations

public extension AgenticLLMPlugin {
    func settingsView() -> NSView? { nil }
    func validateCredentials(_ credentials: PluginCredentials) async -> String? { nil }
}

import AppKit
import AgenticToolkitCore

/// Protocol that all LLM provider plugins must conform to.
///
/// Each plugin is a compiled macOS `.aiplugin` bundle with an
/// `NSPrincipalClass` that conforms to this protocol. The plugin manager
/// discovers bundles by reading their `Info.plist` metadata and only loads
/// the binary when the plugin is first used.
public protocol AIPlugin: AnyObject, Sendable {

    /// Unique reverse-DNS identifier (e.g. "com.agentictoolkit.plugin.anthropic").
    /// Must match the `AgenticPluginIdentifier` in the bundle's Info.plist.
    static var identifier: String { get }

    /// Human-readable name shown in the UI.
    var displayName: String { get }

    /// Capability flags this plugin supports.
    var capabilities: AIPluginCapability { get }

    /// Available models, ordered cheapest first.
    var availableModels: [String] { get }

    /// The recommended model for cheap/fast tasks like summarization.
    var recommendedModel: String { get }

    /// Whether this plugin requires an API key to function.
    var requiresAPIKey: Bool { get }

    /// Initialize with a context providing a logger and data directory.
    init(context: AIPluginContext)

    /// Send messages and receive a response as a stream.
    ///
    /// Streaming plugins yield chunks as they arrive. Non-streaming plugins
    /// yield a single result and finish. Callers should concatenate all chunks.
    func sendMessages(
        _ messages: [AIPluginMessage],
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        credentials: AIPluginCredentials
    ) -> AsyncThrowingStream<String, Error>

    /// Tool-aware streaming variant. Plugins that advertise the
    /// `.functionCalling` capability override this to translate `tools` into
    /// the provider's tool format and emit `.toolUse` events when the model
    /// asks to call one. The default implementation delegates to the text-only
    /// `sendMessages` and yields every chunk as `.textDelta`, followed by a
    /// single `.end(stopReason: nil)`.
    func sendMessages(
        _ messages: [AIPluginMessage],
        tools: [ToolDefinition],
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        credentials: AIPluginCredentials
    ) -> AsyncThrowingStream<ChatStreamEvent, Error>

    /// Optional: provide a settings panel view controller for this plugin.
    /// The returned controller is hosted in the app's `SettingsViewController`
    /// sidebar; return nil for plugins that have no per-plugin settings UI.
    @MainActor
    func settingsPanelViewController() -> ComposableSettings.SettingsPanelViewController?

    /// Validate credentials by making a minimal API call.
    /// Returns nil on success, or an error message string on failure.
    func validateCredentials(_ credentials: AIPluginCredentials) async -> String?
}

extension AIPlugin {
    public func sendMessages(
        _ messages: [AIPluginMessage],
        tools: [ToolDefinition],
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        credentials: AIPluginCredentials
    ) -> AsyncThrowingStream<ChatStreamEvent, Error> {
        let textStream = sendMessages(
            messages,
            model: model,
            systemPrompt: systemPrompt,
            maxTokens: maxTokens,
            credentials: credentials
        )
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await chunk in textStream {
                        continuation.yield(.textDelta(chunk))
                    }
                    continuation.yield(.end(stopReason: nil))
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }
}

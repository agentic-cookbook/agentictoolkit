import Foundation
import AgenticToolkitCore
import AIPluginKit

/// Supplies the currently-selected plugin identifier, model, and resolved config
/// values to an `AIPluginChatBackend`. Apps typically conform their settings view
/// model to this protocol so backend selection tracks the UI live.
///
/// `pluginConfigValues` is the already-resolved `[key: value]` map the plugin
/// reads through `AIPluginConfig` — secrets included. Hosts build it from the
/// plugin's descriptor (see `PluginConfigStore.configValues(for:)`), so the
/// backend never touches storage or the Keychain itself.
@MainActor
public protocol ChatConfigProvider: AnyObject {
    var selectedPluginIdentifier: String { get }
    var selectedModel: String { get }
    var pluginConfigValues: [String: String] { get }
}

/// A `ChatBackend` that routes messages through an `AIPluginManager`: it loads
/// the currently selected plugin, asks it to *describe* the request, then drives
/// that request with `PluginTransport` and maps the decoded `AIStreamEvent`s onto
/// the chat UI's `ChatStreamEvent`s.
///
/// - Important: Deprecated. New code conforms to `ChatSession` (e.g.
///   `LocalChatSession`). This rides `ChatBackendSession` until AgenticToolkitApp
///   and Whippet migrate, then it (and `WhippetChatBackend`) are deleted.
///
/// Not main-actor isolated itself — the per-call work (resolving the plugin and
/// reading config) is done inside a `MainActor.run` block, leaving the transport
/// and decoding off the main actor.
///
/// ### Readiness signalling
/// Hosts that drive plugin/config changes (e.g. settings UI) call
/// `notifyReadyChanged()` when readiness might have flipped. All subscribers of
/// `isReadyChanges()` are notified; a backend with no subscribers is a no-op cost.
///
/// ### Why `@unchecked Sendable` is safe
/// - `pluginManager` is `@MainActor`-isolated; its state is read only inside `MainActor.run`.
/// - `subscribers` is mutated only while holding `lock` (`NSLock`).
/// - `configProvider` is `weak` and dereferenced only inside `MainActor.run`.
/// No mutable state escapes these barriers.
public final class AIPluginChatBackend: ChatBackend, @unchecked Sendable {

    private let pluginManager: AIPluginManager
    private weak var configProvider: ChatConfigProvider?

    /// Multicast subscriber registry for `isReadyChanges()`. Protected by `lock`.
    private let lock = NSLock()
    private var subscribers: [UUID: AsyncStream<Bool>.Continuation] = [:]

    /// Initializer is implicitly main-actor: both inputs are `@MainActor` types.
    @MainActor
    public init(pluginManager: AIPluginManager, configProvider: ChatConfigProvider) {
        self.pluginManager = pluginManager
        self.configProvider = configProvider
    }

    deinit {
        lock.lock()
        for (_, continuation) in subscribers { continuation.finish() }
        subscribers.removeAll()
        lock.unlock()
    }

    // MARK: - isReady

    public var isReady: Bool {
        get async {
            await MainActor.run { Self.isReady(for: configProvider) }
        }
    }

    public func isReadyChanges() -> AsyncStream<Bool> {
        let id = UUID()
        let stream = AsyncStream<Bool> { continuation in
            lock.lock()
            subscribers[id] = continuation
            lock.unlock()

            // Seed the new subscriber with the current value.
            Task { [weak self] in
                guard let self else {
                    continuation.finish()
                    return
                }
                let value = await MainActor.run { Self.isReady(for: self.configProvider) }
                continuation.yield(value)
            }

            continuation.onTermination = { [weak self] _ in
                guard let self else { return }
                self.lock.lock()
                self.subscribers.removeValue(forKey: id)
                self.lock.unlock()
            }
        }
        return stream
    }

    /// Hosts call this after a change that might have flipped readiness (plugin
    /// selection, credential changes). Recomputes and multicasts to all active
    /// subscribers.
    @MainActor
    public func notifyReadyChanged() {
        let value = Self.isReady(for: configProvider)
        lock.lock()
        let snapshot = subscribers.values
        lock.unlock()
        for cont in snapshot { cont.yield(value) }
    }

    @MainActor
    private static func isReady(for config: ChatConfigProvider?) -> Bool {
        !(config?.selectedPluginIdentifier.isEmpty ?? true)
    }

    // MARK: - sendMessages

    public func sendMessages(_ messages: [ChatBackendMessage]) async -> AsyncThrowingStream<String, Error> {
        let inputs = await makeInputs(messages: messages, tools: [])
        return AsyncThrowingStream { continuation in
            let task = Self.drive(inputs: inputs) { event in
                if case .textDelta(let text) = event { continuation.yield(text) }
            } onFinish: { error in
                continuation.finish(throwing: error)
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    public func sendMessages(
        _ messages: [ChatBackendMessage],
        tools: [ToolDefinition]
    ) async -> AsyncThrowingStream<ChatStreamEvent, Error> {
        let inputs = await makeInputs(messages: messages, tools: tools)
        return AsyncThrowingStream { continuation in
            let task = Self.drive(inputs: inputs) { event in
                continuation.yield(Self.chatEvent(for: event))
            } onFinish: { error in
                continuation.finish(throwing: error)
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// Errors specific to the plugin-backed chat path.
    public enum AIPluginChatError: Error {
        /// No plugin available for the currently selected identifier.
        case pluginNotAvailable
    }

    // MARK: - Request assembly

    /// The plugin instance plus the fully-built context for one request,
    /// snapshotted from the config provider on the main actor.
    private struct RequestInputs: Sendable {
        let plugin: (any AIPlugin)?
        let context: AIChatContext
    }

    private func makeInputs(messages: [ChatBackendMessage], tools: [ToolDefinition]) async -> RequestInputs {
        await MainActor.run {
            let pluginId = configProvider?.selectedPluginIdentifier ?? ""
            let model = configProvider?.selectedModel ?? ""
            let values = configProvider?.pluginConfigValues ?? [:]
            let plugin = try? pluginManager.loadPlugin(identifier: pluginId)
            let context = AIChatContext(
                messages: messages.map(Self.aiMessage(for:)),
                model: model,
                systemPrompt: nil,
                tools: tools.map(Self.aiToolSpec(for:)),
                config: AIPluginConfig(values)
            )
            return RequestInputs(plugin: plugin, context: context)
        }
    }

    /// Builds the request, drives the transport, and forwards each decoded event
    /// to `onEvent` until the stream finishes or fails. Returns the backing task
    /// so the caller can cancel it.
    private static func drive(
        inputs: RequestInputs,
        onEvent: @escaping @Sendable (AIStreamEvent) -> Void,
        onFinish: @escaping @Sendable (Error?) -> Void
    ) -> Task<Void, Never> {
        Task {
            guard let plugin = inputs.plugin else {
                onFinish(AIPluginChatError.pluginNotAvailable)
                return
            }
            do {
                let spec = try plugin.buildRequest(inputs.context)
                for try await event in PluginTransport.run(spec: spec, plugin: plugin) {
                    onEvent(event)
                }
                onFinish(nil)
            } catch {
                onFinish(error)
            }
        }
    }

    // MARK: - Mapping

    private static func aiMessage(for msg: ChatBackendMessage) -> AIChatMessage {
        AIChatMessage(
            role: aiRole(for: msg.role),
            content: msg.content,
            toolUseId: msg.toolUseId,
            toolName: msg.toolName,
            toolArgumentsJSON: msg.toolArgumentsJSON,
            toolIsError: msg.toolIsError
        )
    }

    private static func aiToolSpec(for tool: ToolDefinition) -> AIToolSpec {
        AIToolSpec(name: tool.name, description: tool.description, parametersJSONSchema: tool.parametersJSONSchema)
    }

    private static func aiRole(for role: ChatBackendMessage.Role) -> AIChatMessage.Role {
        switch role {
        case .user: return .user
        case .assistant: return .assistant
        case .system: return .system
        case .toolUse: return .toolUse
        case .toolResult: return .toolResult
        }
    }

    private static func chatEvent(for event: AIStreamEvent) -> ChatStreamEvent {
        switch event {
        case .textDelta(let text): return .textDelta(text)
        case .toolUse(let id, let name, let argumentsJSON):
            return .toolUse(id: id, name: name, argumentsJSON: argumentsJSON)
        case .end(let stopReason): return .end(stopReason: stopReason)
        }
    }
}

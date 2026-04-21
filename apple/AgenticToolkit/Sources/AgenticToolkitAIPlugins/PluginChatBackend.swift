import Foundation
import os
import AgenticToolkitChatWindow

/// Supplies the currently-selected plugin identifier, model, and credentials
/// to a `PluginChatBackend`. Apps typically conform their settings view model
/// to this protocol so backend selection tracks the UI live.
@MainActor
public protocol ChatConfigProvider: AnyObject {
    var selectedPluginIdentifier: String { get }
    var selectedModel: String { get }
    var pluginCredentials: PluginCredentials { get }
}

/// A `ChatBackend` that routes messages through an `AgenticPluginSDK.PluginManager`,
/// using the currently selected plugin, model, and credentials from a `ChatConfigProvider`.
///
/// Not main-actor isolated itself — the per-call work (resolving the plugin and
/// reading config) is done inside `MainActor.run` blocks. This lets the chat UI
/// keep the network/streaming work off the main actor while still safely
/// reading configuration that lives on it.
///
/// ### Readiness signalling
/// Hosts that drive plugin/credential changes (e.g. settings UI) call
/// `notifyReadyChanged()` when readiness might have flipped. All subscribers
/// of `isReadyChanges()` are notified; a backend with no subscribers is a
/// no-op cost.
///
/// ### Why `@unchecked Sendable` is safe
/// - `pluginManager` is `@MainActor`-isolated; its state is only read inside `MainActor.run`.
/// - `subscribers` is mutated only while holding `lock` (`NSLock`).
/// - `configProvider` is `weak` and dereferenced only inside `MainActor.run`.
/// No mutable state escapes these barriers.
public final class PluginChatBackend: ChatBackend, @unchecked Sendable {

    private let pluginManager: PluginManager
    private weak var configProvider: ChatConfigProvider?

    /// Multicast subscriber registry for `isReadyChanges()`. Protected by `lock`.
    private let lock = NSLock()
    private var subscribers: [UUID: AsyncStream<Bool>.Continuation] = [:]

    /// Initializer is implicitly main-actor: both inputs are `@MainActor` types.
    @MainActor
    public init(pluginManager: PluginManager, configProvider: ChatConfigProvider) {
        self.pluginManager = pluginManager
        self.configProvider = configProvider
    }

    deinit {
        lock.lock()
        for (_, c) in subscribers { c.finish() }
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

    /// Hosts call this after a change that might have flipped readiness
    /// (plugin selection, API key changes). Recomputes and multicasts to all
    /// active subscribers.
    @MainActor
    public func notifyReadyChanged() {
        let value = Self.isReady(for: configProvider)
        lock.lock()
        let snapshot = subscribers.values
        lock.unlock()
        for cont in snapshot {
            cont.yield(value)
        }
    }

    @MainActor
    private static func isReady(for config: ChatConfigProvider?) -> Bool {
        !(config?.selectedPluginIdentifier.isEmpty ?? true)
    }

    // MARK: - sendMessages

    public func sendMessages(_ messages: [ChatBackendMessage]) async -> AsyncThrowingStream<String, Error> {
        // Snapshot config and resolve the plugin on the main actor.
        let snapshot: (model: String, creds: PluginCredentials, plugin: AIPlugin?) = await MainActor.run {
            let pluginId = configProvider?.selectedPluginIdentifier ?? ""
            let model = configProvider?.selectedModel ?? ""
            let creds = configProvider?.pluginCredentials ?? PluginCredentials(apiKey: "", baseURL: nil)
            let plugin = try? pluginManager.loadPlugin(identifier: pluginId)
            return (model, creds, plugin)
        }

        let history: [LLMMessage] = messages.map { msg in
            LLMMessage(role: Self.llmRole(for: msg.role), content: msg.content)
        }

        return AsyncThrowingStream { continuation in
            guard let plugin = snapshot.plugin else {
                continuation.finish(throwing: PluginChatError.pluginNotAvailable)
                return
            }
            let task = Task {
                do {
                    let stream = plugin.sendMessages(
                        history,
                        model: snapshot.model,
                        systemPrompt: nil,
                        maxTokens: 2048,
                        credentials: snapshot.creds
                    )
                    for try await chunk in stream {
                        continuation.yield(chunk)
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    /// Errors specific to the plugin-backed chat path.
    public enum PluginChatError: Error {
        /// No plugin available for the currently selected identifier.
        case pluginNotAvailable
    }

    private static func llmRole(for role: ChatBackendMessage.Role) -> LLMMessage.Role {
        switch role {
        case .user: return .user
        case .assistant: return .assistant
        case .system: return .system
        @unknown default: return .user
        }
    }
}

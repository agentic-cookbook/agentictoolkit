// macOS/Features/AIPlugins/LocalChatSession.swift
import Foundation
import AgenticToolkitCore
import AIPluginKit

/// A `ChatSession` that runs turns through an `AIPlugin`. Owns conversation
/// history (plugins are stateless), builds an `AIChatContext` per turn, drives
/// an injected event-stream factory (default: `PluginTransport.run`), and emits
/// `ChatEvent`s. If a `ChatToolSource` is supplied it runs a tool loop.
public final class LocalChatSession: ChatSession, @unchecked Sendable {

    /// Injection seam for the transport, so turn logic is testable without I/O.
    public typealias EventStreamFactory =
        @Sendable (AIRequestSpec, any AIPlugin) -> AsyncThrowingStream<AIStreamEvent, Error>

    private let resolvePlugin: @Sendable () -> (any AIPlugin)?
    private let makeContext: @Sendable ([AIChatMessage]) -> AIChatContext
    private let eventStreamFactory: EventStreamFactory
    private let toolSource: (any ChatToolSource)?

    private let lock = NSLock()
    private var continuation: AsyncStream<ChatEvent>.Continuation?
    private var history: [AIChatMessage] = []
    private var liveTurn: Task<Void, Never>?

    private static let maxToolIterations = 8

    public init(
        resolvePlugin: @escaping @Sendable () -> (any AIPlugin)?,
        makeContext: @escaping @Sendable ([AIChatMessage]) -> AIChatContext,
        eventStreamFactory: @escaping EventStreamFactory = { PluginTransport.run(spec: $0, plugin: $1) },
        toolSource: (any ChatToolSource)? = nil
    ) {
        self.resolvePlugin = resolvePlugin
        self.makeContext = makeContext
        self.eventStreamFactory = eventStreamFactory
        self.toolSource = toolSource
    }

    public func events() -> AsyncStream<ChatEvent> {
        AsyncStream { cont in
            lock.lock(); self.continuation = cont; lock.unlock()
            cont.yield(.stateChanged(.ready))
            cont.onTermination = { [weak self] _ in self?.liveTurn?.cancel() }
        }
    }

    public func send(_ text: String) {
        liveTurn = Task { [weak self] in await self?.runTurn(userText: text) }
    }

    public func interrupt() { liveTurn?.cancel() }

    public func close() {
        liveTurn?.cancel()
        emit(.stateChanged(.closed))
        withLock { continuation }?.finish()
    }

    // MARK: - Turn

    private func runTurn(userText: String) async {
        emit(.userMessage(ChatMessage(role: .user, text: userText)))
        appendHistory(AIChatMessage(role: .user, content: userText))
        emit(.stateChanged(.responding))

        guard let plugin = resolvePlugin() else {
            emit(.turnFailed(ChatError(message: "No AI provider is configured.", isRetryable: false)))
            emit(.stateChanged(.ready))
            return
        }

        let assistantID = UUID().uuidString
        var responseOpened = false

        do {
            for _ in 0..<Self.maxToolIterations {
                let toolDefs = await toolSource?.toolDefinitions() ?? []
                let context = makeContext(snapshotHistory()).withTools(toolDefs)
                let spec = try plugin.buildRequest(context)

                var turnText = ""
                var pendingTools: [(id: String, name: String, args: Data)] = []

                for try await event in eventStreamFactory(spec, plugin) {
                    if Task.isCancelled { break }
                    switch event {
                    case .textDelta(let chunk):
                        if !responseOpened {
                            emit(.responseStarted(messageID: assistantID))
                            responseOpened = true
                        }
                        turnText += chunk
                        emit(.responseDelta(messageID: assistantID, text: chunk))
                    case .toolUse(let id, let name, let args):
                        pendingTools.append((id, name, args))
                        emit(.toolCall(messageID: assistantID, name: name, phase: .started))
                    case .end:
                        continue
                    }
                }

                if !turnText.isEmpty {
                    appendHistory(AIChatMessage(role: .assistant, content: turnText))
                }

                if pendingTools.isEmpty || toolSource == nil { break }

                for use in pendingTools {
                    appendHistory(AIChatMessage(
                        role: .toolUse,
                        content: "",
                        toolUseId: use.id,
                        toolName: use.name,
                        toolArgumentsJSON: use.args
                    ))
                    let result = await toolSource!.callTool(name: use.name, argumentsJSON: use.args)
                    appendHistory(AIChatMessage(
                        role: .toolResult,
                        content: result.content,
                        toolUseId: use.id,
                        toolIsError: result.isError
                    ))
                    emit(.toolCall(messageID: assistantID, name: use.name, phase: .completed))
                }
            }
            if responseOpened { emit(.responseFinished(messageID: assistantID, stopReason: nil)) }
            emit(.stateChanged(.ready))
        } catch {
            emit(.turnFailed(ChatError(message: "Sorry, something went wrong. Let's try again.", isRetryable: true)))
            emit(.stateChanged(.ready))
        }
    }

    // MARK: - Helpers

    private func emit(_ event: ChatEvent) { withLock { continuation }?.yield(event) }
    private func appendHistory(_ msg: AIChatMessage) { lock.lock(); history.append(msg); lock.unlock() }
    private func snapshotHistory() -> [AIChatMessage] { lock.lock(); defer { lock.unlock() }; return history }
    private func withLock<T>(_ body: () -> T) -> T { lock.lock(); defer { lock.unlock() }; return body() }
}

private extension AIChatContext {
    /// Returns a copy with `tools` replaced by the given definitions.
    /// `makeContext` is the one place that knows `AIChatContext`'s shape;
    /// this helper lets the tool loop vary the tool list per turn.
    func withTools(_ defs: [ToolDefinition]) -> AIChatContext {
        AIChatContext(
            messages: messages,
            model: model,
            systemPrompt: systemPrompt,
            maxTokens: maxTokens,
            tools: defs.map {
                AIToolSpec(name: $0.name, description: $0.description, parametersJSONSchema: $0.parametersJSONSchema)
            },
            config: config
        )
    }
}

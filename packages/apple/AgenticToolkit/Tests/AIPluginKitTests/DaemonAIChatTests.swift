import Testing
import Foundation
import AgenticToolkitCore
@testable import AIPluginKit

/// Exercises both `DaemonAIChat.complete` paths through their injectable seams — the
/// plugin path via `PluginRuntime`/`SecretStoring`/`ProviderSettingsReader`, the
/// zero-config default via `CLIRunner`. No real `.aiplugin` bundle, network,
/// `claude -p` subprocess, or Keychain is touched, so the suite is fully hermetic.
@Suite("DaemonAIChat")
struct DaemonAIChatTests {

    private let pluginId = "test.fake"

    // MARK: - Settings fixture

    /// A dictionary-backed `ProviderSettingsReader` seeded with the config-UUID-keyed
    /// registry layout `AIProviderConfigSync` writes: the registry JSON, the selected
    /// id, the non-secret fields ledger + values, and optionally the stored model.
    private func makeSettings(
        selected id: UUID, model: String = "", values: [String: String] = [:]
    ) throws -> ProviderSettingsReader {
        let config = AIProviderConfiguration(
            id: id, name: "T", pluginIdentifier: pluginId, templateId: "custom"
        )
        let registryJSON = try #require(String(bytes: JSONEncoder().encode([config]), encoding: .utf8))
        var dict: [String: String] = [
            AIProviderConfigKeys.configurationsKey: registryJSON,
            AIProviderConfigKeys.selectedConfigIdKey: id.uuidString,
            AIProviderConfigKeys.fieldsKey(config: id): values.keys.joined(separator: "\n")
        ]
        for (field, value) in values {
            dict[AIProviderConfigKeys.fieldKey(config: id, field: field)] = value
        }
        if !model.isEmpty {
            dict[AIProviderConfigKeys.modelKey(config: id)] = model
        }
        let store = dict
        return { store[$0] }
    }

    /// No configuration selected — the zero-config CLI default.
    private var emptySettings: ProviderSettingsReader { { _ in nil } }

    // MARK: - Plugin path

    @Test("plugin path resolves config, forwards ledger values + secrets, accumulates the stream")
    func pluginPathResolvesConfigAndAccumulatesStream() async throws {
        let configId = UUID()
        let settings = try makeSettings(
            selected: configId, values: ["baseURL": "https://api.example/v1"]
        )
        let secretStore = InMemorySecretStore()
        secretStore.set("sk-secret-123", forKey: AIProviderConfigKeys.fieldKey(config: configId, field: "apiKey"))

        let captured = CapturingPlugin.Captured()
        let runtime = makeRuntime(
            captured: captured,
            events: [.textDelta("Hello "), .textDelta("world"), .end(stopReason: nil)]
        )

        let reply = try await DaemonAIChat.complete(
            systemPrompt: "sys", userPrompt: "user question", maxTokens: 64,
            settings: settings, runtime: runtime,
            cliRunner: failingCLIRunner(), secretStore: secretStore
        )

        #expect(reply == "Hello world")
        let context = try #require(captured.context)
        #expect(context.maxTokens == 64)
        #expect(context.systemPrompt == "sys")
        // No model chosen → the descriptor's default, injected as authoritative.
        #expect(context.model == "fake-small")
        #expect(context.config.model == "fake-small")
        // Secret resolved from the secret store; plain field from the settings ledger.
        #expect(context.config.apiKey == "sk-secret-123")
        #expect(context.config.baseURL == "https://api.example/v1")
        // The prompt is delivered as a single user message.
        #expect(context.messages.count == 1)
        #expect(context.messages.first?.role == .user)
        #expect(context.messages.first?.content == "user question")
    }

    @Test("plugin path honors the configuration's stored model over the descriptor default")
    func pluginPathHonorsStoredModel() async throws {
        let configId = UUID()
        let settings = try makeSettings(selected: configId, model: "fake-large")

        let captured = CapturingPlugin.Captured()
        let runtime = makeRuntime(captured: captured, events: [.textDelta("ok"), .end(stopReason: nil)])

        _ = try await DaemonAIChat.complete(
            systemPrompt: "s", userPrompt: "u", maxTokens: 8,
            settings: settings, runtime: runtime,
            cliRunner: failingCLIRunner(), secretStore: InMemorySecretStore()
        )

        let context = try #require(captured.context)
        #expect(context.model == "fake-large")
        #expect(context.config.model == "fake-large")
    }

    @Test("plugin path forwards every ledger value, not a hardcoded field list")
    func pluginPathForwardsArbitraryLedgerValue() async throws {
        // `apiVersion` is deliberately NOT a declared descriptor field: the config bag
        // must be rebuilt from the ledger, so template-level defaults beyond
        // baseURL/authMode survive the headless path.
        let configId = UUID()
        let settings = try makeSettings(
            selected: configId,
            values: ["baseURL": "https://api.example/v1", "apiVersion": "2026-01-01"]
        )

        let captured = CapturingPlugin.Captured()
        let runtime = makeRuntime(captured: captured, events: [.textDelta("ok"), .end(stopReason: nil)])

        _ = try await DaemonAIChat.complete(
            systemPrompt: "s", userPrompt: "u", maxTokens: 8,
            settings: settings, runtime: runtime,
            cliRunner: failingCLIRunner(), secretStore: InMemorySecretStore()
        )

        let context = try #require(captured.context)
        #expect(context.config["apiVersion"] == "2026-01-01")
        #expect(context.config.baseURL == "https://api.example/v1")
    }

    @Test("plugin path maps an empty stream to emptyReply, never a blank string")
    func pluginPathEmptyStreamThrowsEmptyReply() async throws {
        let configId = UUID()
        let settings = try makeSettings(selected: configId)
        let runtime = makeRuntime(captured: CapturingPlugin.Captured(), events: [.end(stopReason: nil)])

        let error = await chatError {
            _ = try await DaemonAIChat.complete(
                systemPrompt: "s", userPrompt: "u", maxTokens: 8,
                settings: settings, runtime: runtime,
                cliRunner: failingCLIRunner(), secretStore: InMemorySecretStore()
            )
        }
        guard case .emptyReply? = error else {
            Issue.record("expected emptyReply, got \(String(describing: error))")
            return
        }
    }

    @Test("plugin path surfaces the transport error's message in providerError")
    func pluginPathTransportErrorMapsToProviderError() async throws {
        let configId = UUID()
        let settings = try makeSettings(selected: configId)
        let runtime = makeRuntime(captured: CapturingPlugin.Captured(), events: [], error: FakeError.boom)

        let error = await chatError {
            _ = try await DaemonAIChat.complete(
                systemPrompt: "s", userPrompt: "u", maxTokens: 8,
                settings: settings, runtime: runtime,
                cliRunner: failingCLIRunner(), secretStore: InMemorySecretStore()
            )
        }
        guard case .providerError(let message)? = error else {
            Issue.record("expected providerError, got \(String(describing: error))")
            return
        }
        #expect(message.contains("boom"), "the transport error's message must reach providerError: \(message)")
    }

    // MARK: - Zero-config CLI default path

    @Test("no selected configuration → the CLI runner, defaulting to haiku; no plugin is loaded")
    func noSelectionUsesCLIRunner() async throws {
        let captured = CLICaptured()
        let reply = try await DaemonAIChat.complete(
            systemPrompt: "sys", userPrompt: "question", maxTokens: 8,
            settings: emptySettings, runtime: failingPluginRuntime(),
            cliRunner: captured.runner(returning: "answer"), secretStore: InMemorySecretStore()
        )

        #expect(reply == "answer")
        #expect(captured.model == "haiku")
        #expect(captured.systemPrompt == "sys")
        #expect(captured.prompt == "question")
    }

    @Test("CLI binaryNotFound maps to claudeNotFound")
    func cliBinaryNotFoundMapsToClaudeNotFound() async throws {
        let error = await chatError {
            _ = try await DaemonAIChat.complete(
                systemPrompt: "s", userPrompt: "u", maxTokens: 8,
                settings: emptySettings, runtime: failingPluginRuntime(),
                cliRunner: { _, _, _, _ in throw ClaudeCLI.CLIError.binaryNotFound },
                secretStore: InMemorySecretStore()
            )
        }
        guard case .claudeNotFound? = error else {
            Issue.record("expected claudeNotFound, got \(String(describing: error))")
            return
        }
    }

    @Test("CLI emptyReply maps to emptyReply")
    func cliEmptyReplyMapsToEmptyReply() async throws {
        let error = await chatError {
            _ = try await DaemonAIChat.complete(
                systemPrompt: "s", userPrompt: "u", maxTokens: 8,
                settings: emptySettings, runtime: failingPluginRuntime(),
                cliRunner: { _, _, _, _ in throw ClaudeCLI.CLIError.emptyReply },
                secretStore: InMemorySecretStore()
            )
        }
        guard case .emptyReply? = error else {
            Issue.record("expected emptyReply, got \(String(describing: error))")
            return
        }
    }

    @Test("CLI nonZeroExit carries stderr into providerError")
    func cliNonZeroExitMapsToProviderError() async throws {
        let error = await chatError {
            _ = try await DaemonAIChat.complete(
                systemPrompt: "s", userPrompt: "u", maxTokens: 8,
                settings: emptySettings, runtime: failingPluginRuntime(),
                cliRunner: { _, _, _, _ in
                    throw ClaudeCLI.CLIError.nonZeroExit(code: 2, stderr: "model unavailable")
                },
                secretStore: InMemorySecretStore()
            )
        }
        guard case .providerError(let message)? = error else {
            Issue.record("expected providerError, got \(String(describing: error))")
            return
        }
        #expect(message.contains("model unavailable"), "stderr must reach providerError: \(message)")
    }

    // MARK: - Search paths

    @Test("plugin search paths include ~/.agenticplugins as file URLs")
    func pluginSearchPathsIncludeHomeAgenticplugins() {
        let paths = DaemonAIChat.pluginSearchPaths()
        let home = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".agenticplugins")
        #expect(paths.contains(home))
        #expect(paths.allSatisfy { $0.isFileURL })
    }

    // MARK: - DaemonProviderResolver

    @Test("resolver decodes the registry and matches the selected id")
    func resolverSelectsConfiguration() throws {
        let configId = UUID()
        let settings = try makeSettings(selected: configId)
        let selected = try #require(DaemonProviderResolver.selectedConfiguration(settings))
        #expect(selected.id == configId)
        #expect(selected.pluginIdentifier == pluginId)
    }

    @Test("resolver returns nil / empty for an absent or malformed registry")
    func resolverToleratesAbsentOrMalformedRegistry() {
        #expect(DaemonProviderResolver.selectedConfiguration(emptySettings) == nil)
        #expect(DaemonProviderResolver.configurations(emptySettings).isEmpty)

        let garbage: ProviderSettingsReader = { key in
            key == AIProviderConfigKeys.configurationsKey ? "not json" : nil
        }
        #expect(DaemonProviderResolver.configurations(garbage).isEmpty)
    }

    @Test("resolver reads a configuration's stored model, empty when unset")
    func resolverReadsStoredModel() throws {
        let configId = UUID()
        #expect(DaemonProviderResolver.model(config: configId, emptySettings).isEmpty)
        let settings = try makeSettings(selected: configId, model: "fake-large")
        #expect(DaemonProviderResolver.model(config: configId, settings) == "fake-large")
    }

    // MARK: - Helpers

    private func makeRuntime(
        captured: CapturingPlugin.Captured,
        events: [AIStreamEvent],
        error: FakeError? = nil
    ) -> DaemonAIChat.PluginRuntime {
        let plugin = CapturingPlugin(captured: captured)
        let descriptor = AIPluginDescriptor(
            identifier: pluginId,
            displayName: "Test Fake",
            version: "1.0",
            models: ["fake-small", "fake-large"],
            defaultModel: "fake-small",
            fields: [
                AIPluginDescriptor.Field(key: "apiKey", label: "API Key", kind: .secret),
                AIPluginDescriptor.Field(key: "baseURL", label: "Base URL", kind: .text)
            ]
        )
        return DaemonAIChat.PluginRuntime(
            load: { _, _ in (plugin, descriptor) },
            run: { _, _ in
                AsyncThrowingStream { continuation in
                    if let error {
                        continuation.finish(throwing: error)
                    } else {
                        for event in events { continuation.yield(event) }
                        continuation.finish()
                    }
                }
            }
        )
    }

    /// A plugin runtime that fails the test if it is ever exercised — used on the
    /// CLI-default path to prove no plugin is loaded.
    private func failingPluginRuntime() -> DaemonAIChat.PluginRuntime {
        DaemonAIChat.PluginRuntime(
            load: { _, _ in
                Issue.record("CLI-default path must not load a plugin")
                throw FakeError.boom
            },
            run: { _, _ in AsyncThrowingStream { $0.finish() } }
        )
    }

    /// A CLI runner that fails the test if it is ever called — used on the plugin
    /// path to prove the subprocess fallback is not invoked.
    private func failingCLIRunner() -> DaemonAIChat.CLIRunner {
        { _, _, _, _ in
            Issue.record("plugin path must not invoke the CLI runner")
            return ""
        }
    }

    /// Runs the block, expecting it to throw a `DaemonAIChat.ChatError`, and returns it
    /// for the caller to match on (recording an issue — and returning nil — when nothing
    /// or something else was thrown).
    private func chatError(from body: () async throws -> Void) async -> DaemonAIChat.ChatError? {
        do {
            try await body()
            Issue.record("expected a ChatError to be thrown")
        } catch let error as DaemonAIChat.ChatError {
            return error
        } catch {
            Issue.record("unexpected error type: \(error)")
        }
        return nil
    }
}

// MARK: - Fakes

private enum FakeError: Error, LocalizedError {
    case boom
    // A stable, predictable description so a test can assert it propagates through
    // the error mapping (the default Error string would be opaque).
    var errorDescription: String? { "boom" }
}

/// In-memory `SecretStoring` so no test touches the real login keychain.
private final class InMemorySecretStore: SecretStoring, @unchecked Sendable {
    private let lock = NSLock()
    private var store: [String: String] = [:]

    func get(forKey key: String) -> String? { lock.withLock { store[key] } }

    @discardableResult
    func set(_ value: String, forKey key: String) -> Bool {
        lock.withLock { store[key] = value }
        return true
    }

    @discardableResult
    func delete(forKey key: String) -> Bool {
        lock.withLock { store[key] = nil }
        return true
    }

    @discardableResult
    func deleteLegacy(forKey key: String) -> Bool { true }
}

/// Records the arguments passed to the injected CLI runner so tests can assert model
/// selection, system prompt, and prompt content without a subprocess.
private final class CLICaptured: @unchecked Sendable {
    private let lock = NSLock()
    private var storedPrompt: String?
    private var storedSystemPrompt: String?
    private var storedModel: String?

    var prompt: String? { lock.withLock { storedPrompt } }
    var systemPrompt: String? { lock.withLock { storedSystemPrompt } }
    var model: String? { lock.withLock { storedModel } }

    func runner(returning reply: String) -> DaemonAIChat.CLIRunner {
        { [self] prompt, systemPrompt, model, _ in
            lock.withLock {
                storedPrompt = prompt
                storedSystemPrompt = systemPrompt
                storedModel = model
            }
            return reply
        }
    }
}

/// An `AIPlugin` that records the context it was asked to build a request for, so tests
/// can assert what `complete` resolved. Returns a throwaway HTTP spec; the stream itself
/// comes from the injected `PluginRuntime.run`, not the transport.
private final class CapturingPlugin: AIPlugin {

    final class Captured: @unchecked Sendable {
        private let lock = NSLock()
        private var stored: AIChatContext?
        var context: AIChatContext? {
            get { lock.withLock { stored } }
            set { lock.withLock { stored = newValue } }
        }
    }

    let captured: Captured

    init() { self.captured = Captured() }
    init(captured: Captured) { self.captured = captured }

    func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
        captured.context = context
        return .http(url: URL(string: "https://example.invalid/v1")!)
    }

    func makeDecoder() -> any AIStreamDecoder { NoopDecoder() }
}

private final class NoopDecoder: AIStreamDecoder {
    func consume(_ data: Data) -> [AIStreamEvent] { [] }
}

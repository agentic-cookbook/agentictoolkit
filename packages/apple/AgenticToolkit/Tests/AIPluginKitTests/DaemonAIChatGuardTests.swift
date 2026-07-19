import Testing
import Foundation
import AgenticToolkitCore
@testable import AIPluginKit

/// The guard enforced inside `DaemonAIChat.complete`: a blocked local model is
/// refused BEFORE the plugin runtime runs, remote providers bypass the guard, and
/// `inferenceGuard: nil` opts out entirely.
@Suite("DaemonAIChat guard")
struct DaemonAIChatGuardTests {

    private let pluginId = "test.fake"
    private static let ram: UInt64 = 64_000_000_000
    private static let tags = Data("""
        {"models":[{"name":"big:latest","size":51000000000},
                   {"name":"small:latest","size":4900000000}]}
        """.utf8)

    private func makeSettings(
        selected id: UUID, model: String, baseURL: String
    ) throws -> ProviderSettingsReader {
        let config = AIProviderConfiguration(
            id: id, name: "T", pluginIdentifier: pluginId, templateId: "custom"
        )
        let registryJSON = try #require(String(bytes: JSONEncoder().encode([config]), encoding: .utf8))
        let dict: [String: String] = [
            AIProviderConfigKeys.configurationsKey: registryJSON,
            AIProviderConfigKeys.selectedConfigIdKey: id.uuidString,
            AIProviderConfigKeys.fieldsKey(config: id): "baseURL",
            AIProviderConfigKeys.fieldKey(config: id, field: "baseURL"): baseURL,
            AIProviderConfigKeys.modelKey(config: id): model
        ]
        let store = dict
        return { store[$0] }
    }

    private func makeGuard(pressure: MemoryPressureLevel) -> LocalInferenceGuard {
        LocalInferenceGuard(
            catalog: LocalModelCatalog(fetcher: { _ in Self.tags }),
            memory: FixedMemory(physicalRAM: Self.ram, pressureLevel: pressure))
    }

    /// A runtime that fails the test if the plugin transport is ever exercised.
    private func forbiddenRuntime() -> DaemonAIChat.PluginRuntime {
        DaemonAIChat.PluginRuntime(
            load: { _, _ in
                Issue.record("transport must not run for a refused request")
                throw URLError(.badURL)
            },
            run: { _, _ in AsyncThrowingStream { $0.finish() } }
        )
    }

    private var forbiddenCLI: DaemonAIChat.CLIRunner {
        { _, _, _, _ in
            Issue.record("a guard refusal must never cascade into claude -p")
            return ""
        }
    }

    @Test("a blocked local model throws before any transport runs")
    func blockedModelThrowsBeforeTransport() async throws {
        let settings = try makeSettings(
            selected: UUID(), model: "big:latest", baseURL: "http://localhost:11434/v1")
        await #expect(throws: AIGuardError.self) {
            _ = try await DaemonAIChat.complete(
                systemPrompt: "s", userPrompt: "u", maxTokens: 8,
                settings: settings, runtime: forbiddenRuntime(),
                cliRunner: forbiddenCLI, secretStore: InMemorySecretStore(),
                inferenceGuard: makeGuard(pressure: .normal))
        }
    }

    @Test("pressure defers even a small local model")
    func pressureDefersSmallModel() async throws {
        let settings = try makeSettings(
            selected: UUID(), model: "small:latest", baseURL: "http://localhost:11434/v1")
        do {
            _ = try await DaemonAIChat.complete(
                systemPrompt: "s", userPrompt: "u", maxTokens: 8,
                settings: settings, runtime: forbiddenRuntime(),
                cliRunner: forbiddenCLI, secretStore: InMemorySecretStore(),
                inferenceGuard: makeGuard(pressure: .warning))
            Issue.record("expected AIGuardError.deferred")
        } catch let error as AIGuardError {
            guard case .deferred = error else {
                Issue.record("expected deferred, got \(error)")
                return
            }
        }
    }

    @Test("an allowed local model completes through the plugin path")
    func allowedLocalModelCompletes() async throws {
        let settings = try makeSettings(
            selected: UUID(), model: "small:latest", baseURL: "http://localhost:11434/v1")
        let runtime = makeRuntime(
            captured: CapturingPlugin.Captured(),
            events: [.textDelta("ok"), .end(stopReason: nil)])
        let reply = try await DaemonAIChat.complete(
            systemPrompt: "s", userPrompt: "u", maxTokens: 8,
            settings: settings, runtime: runtime,
            cliRunner: forbiddenCLI, secretStore: InMemorySecretStore(),
            inferenceGuard: makeGuard(pressure: .normal))
        #expect(reply == "ok")
    }

    @Test("remote providers bypass the guard even under critical pressure")
    func remoteProviderBypassesGuard() async throws {
        let settings = try makeSettings(
            selected: UUID(), model: "big:latest", baseURL: "https://api.example/v1")
        let runtime = makeRuntime(
            captured: CapturingPlugin.Captured(),
            events: [.textDelta("remote ok"), .end(stopReason: nil)])
        let reply = try await DaemonAIChat.complete(
            systemPrompt: "s", userPrompt: "u", maxTokens: 8,
            settings: settings, runtime: runtime,
            cliRunner: forbiddenCLI, secretStore: InMemorySecretStore(),
            inferenceGuard: makeGuard(pressure: .critical))
        #expect(reply == "remote ok")
    }

    @Test("inferenceGuard: nil opts out entirely")
    func nilGuardOptsOut() async throws {
        let settings = try makeSettings(
            selected: UUID(), model: "big:latest", baseURL: "http://localhost:11434/v1")
        let runtime = makeRuntime(
            captured: CapturingPlugin.Captured(),
            events: [.textDelta("unguarded"), .end(stopReason: nil)])
        let reply = try await DaemonAIChat.complete(
            systemPrompt: "s", userPrompt: "u", maxTokens: 8,
            settings: settings, runtime: runtime,
            cliRunner: forbiddenCLI, secretStore: InMemorySecretStore(),
            inferenceGuard: nil)
        #expect(reply == "unguarded")
    }
}

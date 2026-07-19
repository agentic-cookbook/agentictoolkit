import Testing
import Foundation
import AgenticToolkitCore
@testable import AIPluginKit

// MARK: - Fakes shared across the AIPluginKitTests bundle
//
// Extracted from `DaemonAIChatTests.swift` (unchanged apart from visibility) so
// `DaemonAIChatGuardTests.swift` can reuse the same fake plugin/CLI/secret-store
// fixtures instead of duplicating them.

enum FakeError: Error, LocalizedError {
    case boom
    // A stable, predictable description so a test can assert it propagates through
    // the error mapping (the default Error string would be opaque).
    var errorDescription: String? { "boom" }
}

/// In-memory `SecretStoring` so no test touches the real login keychain.
final class InMemorySecretStore: SecretStoring, @unchecked Sendable {
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

/// An `AIPlugin` that records the context it was asked to build a request for, so tests
/// can assert what `complete` resolved. Returns a throwaway HTTP spec; the stream itself
/// comes from the injected `PluginRuntime.run`, not the transport.
final class CapturingPlugin: AIPlugin {

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

final class NoopDecoder: AIStreamDecoder {
    func consume(_ data: Data) -> [AIStreamEvent] { [] }
}

/// A runtime whose `load` returns a `CapturingPlugin` plus a descriptor (the given
/// one, or a default two-model fake), and whose `run` replays `events` (or throws
/// `error`). Shared by both `DaemonAIChatTests` and `DaemonAIChatGuardTests`; the
/// default descriptor's `identifier` is the literal "test.fake" — both suites'
/// settings fixtures register their configuration under that same plugin id.
func makeRuntime(
    captured: CapturingPlugin.Captured,
    events: [AIStreamEvent],
    error: FakeError? = nil,
    descriptor: AIPluginDescriptor? = nil
) -> DaemonAIChat.PluginRuntime {
    let plugin = CapturingPlugin(captured: captured)
    let resolvedDescriptor = descriptor ?? AIPluginDescriptor(
        identifier: "test.fake",
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
        load: { _, _ in (plugin, resolvedDescriptor) },
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

/// A CLI runner that fails the test if it is ever called — used on the plugin
/// path to prove the subprocess fallback is not invoked.
func failingCLIRunner() -> DaemonAIChat.CLIRunner {
    { _, _, _, _ in
        Issue.record("plugin path must not invoke the CLI runner")
        return ""
    }
}

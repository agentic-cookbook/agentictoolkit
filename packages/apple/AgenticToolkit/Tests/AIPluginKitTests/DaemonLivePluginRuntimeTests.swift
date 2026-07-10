import Testing
import Foundation
@testable import AIPluginKit

/// Coverage for the *production* `DaemonAIChat.PluginRuntime.live` load path. The
/// `DaemonAIChat` tests inject a fake runtime, so nothing there exercises the real
/// `.live` closure: the `MainActor`-bound `LivePluginCache` → real `AIPluginManager` →
/// on-disk discovery → descriptor decode → load attempt → error mapping. These tests
/// drive that real path against on-disk descriptor-only `.aiplugin` fixtures (no
/// compiled binary), covering discovery, the not-installed mapping, the schema-version
/// gate, and the discovered-but-unloadable failure.
///
/// The dlopen-*success* mechanic (a real `.aiplugin` binary whose principal class
/// casts to `AIPlugin`) is intentionally not unit-tested here: it depends on the
/// plugin and the test runner resolving to the *same* `AIPluginKit` image, which is
/// an install/codesign concern verified by host installers + end-to-end runs, not a
/// hermetic unit. The success path's downstream logic (buildRequest → stream → clean)
/// is covered via the injected runtime in `DaemonAIChatTests`.
@Suite("DaemonAIChat.PluginRuntime.live")
final class DaemonLivePluginRuntimeTests {

    private let tempDir: URL

    init() throws {
        tempDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("daemon-live-plugin-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
    }

    deinit {
        try? FileManager.default.removeItem(at: tempDir)
    }

    /// Empty search path: the live runtime builds a real `AIPluginManager`, discovers
    /// nothing, and reports the requested plugin as not installed — mapped to a
    /// `DaemonAIChat.ChatError` so the host surfaces a clear message rather than a
    /// raw manager error.
    @Test("empty search path reports the plugin as not installed")
    func liveLoadReportsNotInstalledWhenNothingDiscovered() async throws {
        do {
            _ = try await DaemonAIChat.PluginRuntime.live.load("test.absent", [tempDir])
            Issue.record("expected a not-installed error for an empty search path")
        } catch let error as DaemonAIChat.ChatError {
            guard case .providerError(let message) = error else {
                Issue.record("expected providerError, got \(error)")
                return
            }
            #expect(message.contains("not installed"), "message should explain the plugin is absent: \(message)")
            #expect(message.contains("test.absent"), "message should name the missing plugin: \(message)")
        }
    }

    /// A discoverable descriptor-only bundle (valid `descriptor.json`, no binary): the
    /// live runtime *discovers* it — proving the real on-disk discovery + descriptor
    /// decode runs — then fails to load the absent binary. The thrown error must be an
    /// `AIPluginManager` load error, NOT the not-installed `ChatError`, which is
    /// what distinguishes "found but unloadable" from "never found".
    @Test("a descriptor-only bundle is discovered, then fails loading the binary")
    func liveLoadDiscoversDescriptorThenFailsLoadingTheBinary() async throws {
        writeDescriptorBundle(id: "test.descriptoronly", name: "DescriptorOnly")

        do {
            _ = try await DaemonAIChat.PluginRuntime.live.load("test.descriptoronly", [tempDir])
            Issue.record("a descriptor-only bundle has no binary and must fail to load")
        } catch let error as DaemonAIChat.ChatError {
            Issue.record("discovery should have found the descriptor; got a not-found mapping instead: \(error)")
        } catch let error as AIPluginManager.AIPluginError {
            // .notFound would mean discovery missed the on-disk descriptor; any other
            // case means it was discovered and the load attempt actually ran.
            if case .notFound = error {
                Issue.record("the descriptor was on disk; discovery should have found it")
            }
        }
    }

    /// A bundle whose `schemaVersion` the host doesn't understand is skipped at
    /// discovery, so the live runtime treats it as not installed — covering the
    /// version gate through the real discovery path.
    @Test("an incompatible schemaVersion is skipped at discovery")
    func liveLoadSkipsIncompatibleSchemaVersion() async throws {
        writeDescriptorBundle(
            id: "test.future", name: "FuturePlugin",
            schemaVersion: AIPluginDescriptor.currentSchemaVersion + 1
        )

        do {
            _ = try await DaemonAIChat.PluginRuntime.live.load("test.future", [tempDir])
            Issue.record("an incompatible-schema bundle must be skipped, yielding not-installed")
        } catch let error as DaemonAIChat.ChatError {
            guard case .providerError(let message) = error else {
                Issue.record("expected providerError, got \(error)")
                return
            }
            #expect(message.contains("not installed"), "skipped plugin should read as not installed: \(message)")
        }
    }

    // MARK: - Fixtures

    /// Writes a `.aiplugin` whose only content is a `descriptor.json`, mirroring the
    /// toolkit's own discovery-test layout: discovery reads it cleanly, but any load
    /// attempt fails because there is no executable.
    private func writeDescriptorBundle(
        id: String, name: String, schemaVersion: Int = AIPluginDescriptor.currentSchemaVersion
    ) {
        let resources = tempDir
            .appendingPathComponent("\(name).aiplugin")
            .appendingPathComponent("Contents/Resources")
        try? FileManager.default.createDirectory(at: resources, withIntermediateDirectories: true)
        let descriptor: [String: Any] = [
            "schemaVersion": schemaVersion,
            "identifier": id,
            "displayName": name,
            "version": "1.0.0",
            "models": ["m1"],
            "fields": []
        ]
        let data = (try? JSONSerialization.data(withJSONObject: descriptor)) ?? Data()
        try? data.write(to: resources.appendingPathComponent("descriptor.json"))
    }
}

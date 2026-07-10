import Foundation
import AgenticToolkitCore

/// A headless host's reusable "ask the local model one question" path — the plugin/
/// config/secret/`PluginTransport` machinery plus the zero-config `claude -p`
/// fallback — so any daemon feature that needs a one-shot completion (session
/// summaries, AI oversight, …) drives the exact same runtime rather than
/// duplicating it.
///
/// Two paths, chosen by the config-UUID-keyed registry the app syncs over
/// `AIProviderConfigSync` (read back through `DaemonProviderResolver`):
/// - **Plugin path** (a configuration is selected): loads that configuration's
///   `.aiplugin`, asks it to *describe* the request, and drives it through
///   `PluginTransport` — the same runtime the host's chat backend uses. The model
///   comes from the configuration's own `AIProviderConfigKeys.modelKey`.
/// - **CLI default** (no configuration selected): a `claude -p` subprocess — the
///   zero-config path that needs no API key, so it works before any provider is
///   configured.
public enum DaemonAIChat {

    /// Injectable seam for the plugin path: loads a plugin and drives its request.
    /// Production wiring (`.live`) discovers `.aiplugin` bundles on disk and uses
    /// `PluginTransport`; tests substitute a fake plugin and canned event stream so
    /// no real bundle, network, or subprocess is touched.
    public struct PluginRuntime: Sendable {
        /// Resolves an identifier to a loaded plugin plus its descriptor (for field
        /// config). Runs on the main actor in production (`AIPluginManager` is
        /// `@MainActor`).
        public var load: @Sendable (_ identifier: String, _ searchPaths: [URL]) async throws
            -> (any AIPlugin, AIPluginDescriptor)
        /// Drives one described request to completion, streaming decoded events.
        public var run: @Sendable (AIRequestSpec, any AIPlugin) -> AsyncThrowingStream<AIStreamEvent, Error>

        public init(
            load: @escaping @Sendable (_ identifier: String, _ searchPaths: [URL]) async throws
                -> (any AIPlugin, AIPluginDescriptor),
            run: @escaping @Sendable (AIRequestSpec, any AIPlugin) -> AsyncThrowingStream<AIStreamEvent, Error>
        ) {
            self.load = load
            self.run = run
        }

        public static let live = PluginRuntime(
            load: { identifier, searchPaths in
                try await MainActor.run {
                    try LivePluginCache.load(identifier: identifier, searchPaths: searchPaths)
                }
            },
            run: PluginTransport.run
        )
    }

    /// Injectable runner for the zero-config `claude -p` default path. Production
    /// (`liveCLIRunner`) spawns the real subprocess; tests substitute a canned reply
    /// (or a thrown `ClaudeCLI.CLIError`) so the legacy path is hermetic.
    public typealias CLIRunner = @Sendable (
        _ prompt: String, _ systemPrompt: String, _ model: String, _ timeout: TimeInterval
    ) async throws -> String

    public static let liveCLIRunner: CLIRunner = { prompt, systemPrompt, model, timeout in
        try await ClaudeCLI.run(prompt: prompt, systemPrompt: systemPrompt, model: model, timeout: timeout)
    }

    /// Generic errors any one-shot completion can hit. Session-specific errors
    /// (no such session, no events) belong to the caller, not here.
    public enum ChatError: Error, LocalizedError {
        case claudeNotFound
        case providerError(String)
        case emptyReply

        public var errorDescription: String? {
            switch self {
            case .claudeNotFound: return "Claude CLI not found (install Claude Code or check PATH)"
            case .providerError(let msg): return msg
            case .emptyReply: return "Empty reply from the model"
            }
        }
    }

    /// Default timeout for a one-shot completion.
    public static let defaultTimeout: TimeInterval = 60

    /// Ask the selected provider one question and return its raw reply text.
    /// Dispatches to the plugin path when the app has selected a registry
    /// configuration; otherwise the zero-config `claude -p` default. `cliModel` is
    /// the model for the CLI path only (the plugin path uses its config's model).
    /// `settings` reads the host's synced provider-registry values by key.
    public static func complete(
        systemPrompt: String,
        userPrompt: String,
        maxTokens: Int,
        cliModel: String = "haiku",
        timeout: TimeInterval = defaultTimeout,
        settings: ProviderSettingsReader,
        runtime: PluginRuntime = .live,
        cliRunner: CLIRunner = liveCLIRunner,
        secretStore: any SecretStoring = KeychainSecretStore()
    ) async throws -> String {
        if let config = DaemonProviderResolver.selectedConfiguration(settings) {
            return try await completeViaPlugin(
                config: config, systemPrompt: systemPrompt, userPrompt: userPrompt,
                maxTokens: maxTokens, settings: settings, runtime: runtime, secretStore: secretStore
            )
        }
        return try await completeViaCLI(
            prompt: userPrompt, systemPrompt: systemPrompt, model: cliModel,
            timeout: timeout, cliRunner: cliRunner
        )
    }

    // MARK: - Claude CLI

    private static func completeViaCLI(
        prompt: String, systemPrompt: String, model: String, timeout: TimeInterval, cliRunner: CLIRunner
    ) async throws -> String {
        do {
            // Default to Haiku for a cheap, fast reply unless a model is given.
            return try await cliRunner(prompt, systemPrompt, model.isEmpty ? "haiku" : model, timeout)
        } catch let error as ClaudeCLI.CLIError {
            switch error {
            case .binaryNotFound:
                throw ChatError.claudeNotFound
            case .emptyReply:
                throw ChatError.emptyReply
            case .launchFailed(let message):
                throw ChatError.providerError("Failed to launch claude: \(message)")
            case .nonZeroExit(let code, let stderr):
                let detail = stderr.isEmpty ? "exit \(code)" : stderr
                throw ChatError.providerError("claude -p failed: \(String(detail.prefix(200)))")
            }
        }
    }

    // MARK: - Plugin path

    /// Directories a headless host scans for `.aiplugin` bundles. Plugins install to
    /// `~/.agenticplugins/`; the executable-relative `Contents/PlugIns` is a
    /// fallback for an eventual app-bundled daemon layout.
    public static func pluginSearchPaths() -> [URL] {
        var paths: [URL] = []
        if let exe = CommandLine.arguments.first, !exe.isEmpty {
            let plugIns = URL(fileURLWithPath: exe)
                .deletingLastPathComponent()
                .appendingPathComponent("../PlugIns")
                .standardizedFileURL
            paths.append(plugIns)
        }
        paths.append(URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent(".agenticplugins"))
        return paths
    }

    /// Loads the selected configuration's plugin, resolves its config-keyed values
    /// (plain fields from the host's settings, secrets from its Keychain namespace,
    /// model from `AIProviderConfigKeys.modelKey(config:)`), asks it to describe a
    /// one-shot request, and accumulates the streamed text.
    private static func completeViaPlugin(
        config: AIProviderConfiguration,
        systemPrompt: String,
        userPrompt: String,
        maxTokens: Int,
        settings: ProviderSettingsReader,
        runtime: PluginRuntime,
        secretStore: any SecretStoring
    ) async throws -> String {
        let pluginId = config.pluginIdentifier
        let (plugin, descriptor): (any AIPlugin, AIPluginDescriptor)
        do {
            (plugin, descriptor) = try await runtime.load(pluginId, pluginSearchPaths())
        } catch let error as ChatError {
            throw error
        } catch {
            throw ChatError.providerError("Failed to load AI plugin '\(pluginId)': \(error.localizedDescription)")
        }

        // Rebuild the `AIPluginConfig` bag from exactly what the host forwarded and
        // stored — NOT by re-deriving from `descriptor.fields`. The host's non-secret
        // `values` (recorded in the config's fields ledger) already carry the
        // descriptor fields PLUS every template-level default (`baseURL`, `authMode`,
        // and any other `ProviderTemplate.defaultValues` entry). Reading the ledger,
        // rather than re-listing descriptor fields and special-casing baseURL/authMode
        // by name, is what keeps a template default beyond those two from being
        // dropped on the headless path.
        var values: [String: String] = [:]
        let ledgerKey = AIProviderConfigKeys.fieldsKey(config: config.id)
        let fieldsLedger = settings(ledgerKey) ?? ""
        for field in fieldsLedger.split(separator: "\n").map(String.init) {
            let key = AIProviderConfigKeys.fieldKey(config: config.id, field: field)
            values[field] = settings(key) ?? ""
        }
        // Secret fields come from the host's Keychain. Represent a declared secret
        // even when empty so `buildRequest` can distinguish "this template requires a
        // key and it's blank" from "keyless template with no secret field".
        for field in descriptor.fields where field.isSecret {
            let key = AIProviderConfigKeys.fieldKey(config: config.id, field: field.key)
            values[field.key] = secretStore.get(forKey: key) ?? ""
        }
        let stored = DaemonProviderResolver.model(config: config.id, settings)
        let model = stored.isEmpty ? descriptor.resolvedDefaultModel : stored
        // `model` is a key reserved by `AIPluginConfig` (read back as `config.model`).
        // Inject the resolved model last so it is authoritative over any same-named
        // descriptor field — a plugin should not declare a field keyed `model`.
        values["model"] = model

        let context = AIChatContext(
            messages: [AIChatMessage(role: .user, content: userPrompt)],
            model: model,
            systemPrompt: systemPrompt,
            maxTokens: maxTokens,
            config: AIPluginConfig(values)
        )

        let spec: AIRequestSpec
        do {
            spec = try plugin.buildRequest(context)
        } catch {
            throw ChatError.providerError("Plugin could not build the request: \(error.localizedDescription)")
        }

        var reply = ""
        do {
            streamLoop: for try await event in runtime.run(spec, plugin) {
                switch event {
                case .textDelta(let text):
                    reply += text
                case .end:
                    // The model signalled completion; stop consuming. (A one-shot reply
                    // has no actionable stop reason — truncation still yields usable
                    // text, and an empty reply is caught by the guard below.)
                    break streamLoop
                case .toolUse:
                    // A one-shot request declares no tools; ignore any stray tool call.
                    break
                }
            }
        } catch {
            throw ChatError.providerError(error.localizedDescription)
        }

        guard !reply.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw ChatError.emptyReply
        }
        return reply
    }

    /// Memoizes the production plugin runtime. A daemon runs many completions over
    /// its lifetime; rebuilding `AIPluginManager` + re-scanning disk + re-`dlopen` on
    /// every call is wasted work, so discovery happens once and loaded plugins are
    /// cached by identifier. Tradeoff: a plugin installed while the process is running
    /// isn't seen until its next launch (which host installers perform anyway).
    /// Keyed by the search-path set so a changed path rebuilds from scratch.
    @MainActor
    private enum LivePluginCache {
        private static var manager: AIPluginManager?
        private static var managerPaths: [URL]?
        private static var loaded: [String: any AIPlugin] = [:]

        static func load(
            identifier: String, searchPaths: [URL]
        ) throws -> (any AIPlugin, AIPluginDescriptor) {
            let mgr: AIPluginManager
            if let manager, managerPaths == searchPaths {
                mgr = manager
            } else {
                mgr = AIPluginManager(searchPaths: searchPaths)
                mgr.discoverPlugins()
                manager = mgr
                managerPaths = searchPaths
                loaded.removeAll()  // search paths changed → prior plugins may be stale
            }
            guard let descriptor = mgr.descriptor(for: identifier) else {
                throw ChatError.providerError("AI plugin not installed: \(identifier)")
            }
            if let plugin = loaded[identifier] {
                return (plugin, descriptor)
            }
            let plugin = try mgr.loadPlugin(identifier: identifier)
            loaded[identifier] = plugin
            return (plugin, descriptor)
        }
    }
}

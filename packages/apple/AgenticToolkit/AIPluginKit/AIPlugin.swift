import Foundation

/// The behavior contract every AI provider plugin implements.
///
/// A plugin is a macOS `.aiplugin` bundle whose `NSPrincipalClass` conforms to
/// this protocol. It is deliberately tiny and Foundation-only: it *describes*
/// requests and *decodes* responses, but performs no networking and ships no
/// UI. The host owns the transport, the settings UI (built from the bundle's
/// `descriptor.json` schema), and secret storage.
///
/// All identity and presentation metadata — identifier, display name, models,
/// capabilities, settings schema — live as data in the bundle, not here, so the
/// host can list and configure a plugin without loading its binary.
///
/// `AIPluginKit` is a Foundation-only dynamic framework that the host embeds and
/// each plugin links *without* embedding, so a plugin resolves to the host's one
/// loaded image at `dlopen` time. That single shared image is what lets the host
/// cast a freshly loaded principal class to `AIPlugin`.
public protocol AIPlugin: AnyObject, Sendable {

    /// Create the plugin. Instances are cheap and may be created per request.
    init()

    /// Describe the HTTP request for one chat turn. Throws if the context is
    /// insufficient (e.g. a required config value is missing).
    func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec

    /// Create a fresh decoder for one response stream. The decoder owns any
    /// per-response parsing state.
    func makeDecoder() -> any AIStreamDecoder

    /// Describe a request that checks whether the given configuration is valid
    /// (e.g. a minimal API call). Return nil if the plugin cannot validate.
    func buildValidationRequest(config: AIPluginConfig) -> AIRequestSpec?

    /// Turn a non-success HTTP response into a human-readable message. Used for
    /// both failed chat requests and credential validation. Return nil to fall
    /// back to a generic "HTTP <status>" message.
    func describeError(status: Int, body: Data) -> String?
}

extension AIPlugin {

    public func buildValidationRequest(config: AIPluginConfig) -> AIRequestSpec? { nil }

    public func describeError(status: Int, body: Data) -> String? { nil }
}

import Foundation
import Testing
import AIPluginKit

/// Characterization tests for each shipping plugin's `buildRequest`: the part a
/// third-party plugin author is most likely to get wrong (endpoints, auth
/// headers, body shape, required-config errors). The plugin sources are compiled
/// into this bundle, so the tests exercise the real types directly without
/// loading the `.aiplugin` bundles (the load/cast path is covered separately by
/// the host app's `--verify-plugins` run).
@Suite("AI plugin request building")
struct PluginRequestTests {

    // MARK: - Builders

    private func config(apiKey: String? = "test-key", baseURL: String? = nil) -> AIPluginConfig {
        var values: [String: String] = [:]
        if let apiKey { values["apiKey"] = apiKey }
        if let baseURL { values["baseURL"] = baseURL }
        return AIPluginConfig(values)
    }

    private func context(
        messages: [AIChatMessage] = [AIChatMessage(role: .user, content: "Hello")],
        model: String = "",
        systemPrompt: String? = nil,
        maxTokens: Int = 256,
        config: AIPluginConfig
    ) -> AIChatContext {
        AIChatContext(
            messages: messages,
            model: model,
            systemPrompt: systemPrompt,
            maxTokens: maxTokens,
            config: config
        )
    }

    // MARK: - Transport unwrapping

    private func httpParts(
        _ spec: AIRequestSpec
    ) -> (AIRequestSpec.Method, URL, [String: String], Data?)? {
        guard case let .http(method, url, headers, body) = spec.transport else { return nil }
        return (method, url, headers, body)
    }

    private func commandParts(
        _ spec: AIRequestSpec
    ) -> (URL, [String], Data?, [String: String])? {
        guard case let .command(executableURL, arguments, stdin, environment) = spec.transport else {
            return nil
        }
        return (executableURL, arguments, stdin, environment)
    }

    private func jsonBody(_ body: Data?) throws -> [String: Any] {
        let data = try #require(body, "request carried no body")
        let object = try JSONSerialization.jsonObject(with: data)
        return try #require(object as? [String: Any], "body was not a JSON object")
    }

    // MARK: - ClaudeAPI

    @Test("ClaudeAPI targets the Anthropic messages endpoint with key + version headers")
    func claudeAPIEndpointAndHeaders() throws {
        let spec = try ClaudeAPIPlugin().buildRequest(context(config: config()))
        let (method, url, headers, _) = try #require(httpParts(spec))
        #expect(method == .post)
        #expect(url.absoluteString == "https://api.anthropic.com/v1/messages")
        #expect(headers["x-api-key"] == "test-key")
        #expect(headers["anthropic-version"] == "2023-06-01")
        #expect(headers["content-type"] == "application/json")
    }

    @Test("ClaudeAPI defaults the model, streams, and drops system-role messages")
    func claudeAPIBody() throws {
        let messages = [
            AIChatMessage(role: .system, content: "ignored as a message"),
            AIChatMessage(role: .user, content: "Hi"),
            AIChatMessage(role: .assistant, content: "Hello")
        ]
        let spec = try ClaudeAPIPlugin().buildRequest(
            context(messages: messages, systemPrompt: "be terse", config: config())
        )
        let (_, _, _, body) = try #require(httpParts(spec))
        let json = try jsonBody(body)
        #expect(json["model"] as? String == "claude-haiku-4-5-20251001")
        #expect(json["max_tokens"] as? Int == 256)
        #expect(json["stream"] as? Bool == true)
        #expect(json["system"] as? String == "be terse")
        let apiMessages = try #require(json["messages"] as? [[String: String]])
        #expect(apiMessages.count == 2)
        #expect(apiMessages[0]["role"] == "user")
        #expect(apiMessages[1]["role"] == "assistant")
    }

    @Test("ClaudeAPI honors an explicitly selected model")
    func claudeAPIExplicitModel() throws {
        let spec = try ClaudeAPIPlugin().buildRequest(context(model: "claude-opus-4-7", config: config()))
        let (_, _, _, body) = try #require(httpParts(spec))
        #expect(try jsonBody(body)["model"] as? String == "claude-opus-4-7")
    }

    @Test("ClaudeAPI throws when the API key is missing")
    func claudeAPIMissingKey() {
        #expect(throws: ClaudeAPIPlugin.PluginError.self) {
            _ = try ClaudeAPIPlugin().buildRequest(context(config: config(apiKey: nil)))
        }
    }

    // MARK: - OpenAI

    @Test("OpenAI targets chat completions with bearer auth and a default model")
    func openAIRequest() throws {
        let spec = try OpenAIPlugin().buildRequest(context(systemPrompt: "sys", config: config()))
        let (method, url, headers, body) = try #require(httpParts(spec))
        #expect(method == .post)
        #expect(url.absoluteString == "https://api.openai.com/v1/chat/completions")
        #expect(headers["Authorization"] == "Bearer test-key")
        let json = try jsonBody(body)
        #expect(json["model"] as? String == "gpt-4.1-nano")
        let messages = try #require(json["messages"] as? [[String: String]])
        #expect(messages.first?["role"] == "system")
        #expect(messages.first?["content"] == "sys")
        #expect(messages.last?["role"] == "user")
    }

    @Test("OpenAI throws when the API key is missing")
    func openAIMissingKey() {
        #expect(throws: OpenAIPlugin.PluginError.self) {
            _ = try OpenAIPlugin().buildRequest(context(config: config(apiKey: nil)))
        }
    }

    // MARK: - Google

    @Test("Google targets gemini generateContent with the key as a query item")
    func googleRequest() throws {
        let spec = try GooglePlugin().buildRequest(context(config: config()))
        let (method, url, headers, body) = try #require(httpParts(spec))
        #expect(method == .post)
        let components = try #require(URLComponents(url: url, resolvingAgainstBaseURL: false))
        #expect(components.host == "generativelanguage.googleapis.com")
        #expect(components.path == "/v1beta/models/gemini-2.0-flash:generateContent")
        #expect(components.queryItems?.first { $0.name == "key" }?.value == "test-key")
        #expect(headers["content-type"] == "application/json")
        // The key rides in the query string, not an auth header.
        #expect(headers["Authorization"] == nil)
        #expect(try jsonBody(body)["contents"] != nil)
    }

    @Test("Google maps assistant messages to the model role")
    func googleRoleMapping() throws {
        let messages = [
            AIChatMessage(role: .user, content: "hi"),
            AIChatMessage(role: .assistant, content: "yo")
        ]
        let spec = try GooglePlugin().buildRequest(context(messages: messages, config: config()))
        let (_, _, _, body) = try #require(httpParts(spec))
        let contents = try #require(try jsonBody(body)["contents"] as? [[String: Any]])
        #expect(contents.count == 2)
        #expect(contents[0]["role"] as? String == "user")
        #expect(contents[1]["role"] as? String == "model")
    }

    @Test("Google throws when the API key is missing")
    func googleMissingKey() {
        #expect(throws: GooglePlugin.PluginError.self) {
            _ = try GooglePlugin().buildRequest(context(config: config(apiKey: nil)))
        }
    }

    // MARK: - OpenAICompatible

    @Test("OpenAICompatible builds chat completions against the user's base URL")
    func openAICompatibleRequest() throws {
        let spec = try OpenAICompatiblePlugin().buildRequest(
            context(config: config(apiKey: "k", baseURL: "https://lmstudio.local"))
        )
        let (method, url, headers, _) = try #require(httpParts(spec))
        #expect(method == .post)
        #expect(url.absoluteString == "https://lmstudio.local/v1/chat/completions")
        #expect(headers["Authorization"] == "Bearer k")
    }

    @Test("OpenAICompatible distinguishes a missing key from a missing base URL")
    func openAICompatibleValidation() {
        let plugin = OpenAICompatiblePlugin()
        // Key checked first: base URL present, key absent -> missingAPIKey.
        #expect(throws: OpenAICompatiblePlugin.PluginError.self) {
            _ = try plugin.buildRequest(context(config: config(apiKey: nil, baseURL: "https://h")))
        }
        // Key present, base URL absent -> missingBaseURL specifically.
        do {
            _ = try plugin.buildRequest(context(config: config(apiKey: "k", baseURL: nil)))
            Issue.record("expected buildRequest to throw when the base URL is missing")
        } catch let error as OpenAICompatiblePlugin.PluginError {
            guard case .missingBaseURL = error else {
                Issue.record("expected .missingBaseURL, got \(error)")
                return
            }
        } catch {
            Issue.record("expected an OpenAICompatiblePlugin.PluginError, got \(error)")
        }
    }

    // MARK: - ClaudeLocal

    @Test("ClaudeLocal describes a claude -p subprocess, or reports the CLI is absent")
    func claudeLocalCommand() throws {
        let plugin = ClaudeLocalPlugin()
        let ctx = context(
            messages: [AIChatMessage(role: .user, content: "Hello")],
            model: "claude-opus-4-7",
            config: config(apiKey: nil)
        )
        do {
            let spec = try plugin.buildRequest(ctx)
            let (executableURL, arguments, stdin, environment) = try #require(commandParts(spec))
            #expect(executableURL.lastPathComponent == "claude")
            #expect(Array(arguments.prefix(3)) == ["-p", "--output-format", "text"])
            #expect(arguments.contains("--max-turns"))
            #expect(arguments.contains("--model"))
            #expect(stdin == Data("Hello".utf8))
            #expect(environment["PATH"]?.contains("/.local/bin") == true)
        } catch let error as ClaudeLocalPlugin.PluginError {
            // No Claude CLI on this machine — the documented failure path.
            guard case .notFound = error else {
                Issue.record("unexpected ClaudeLocalPlugin.PluginError: \(error)")
                return
            }
        }
    }
}

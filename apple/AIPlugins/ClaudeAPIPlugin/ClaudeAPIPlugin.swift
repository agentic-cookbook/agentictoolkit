import AppKit
import Foundation
import os
import AgenticToolkitAIPluginsCore
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow
import AgenticToolkitAIPlugins

/// LLM plugin for the Anthropic Messages API with SSE streaming.
/// Requires an API key from console.anthropic.com.
public final class ClaudeAPIPlugin: NSObject, AIPlugin, @unchecked Sendable {

    public static let identifier = "com.agentictoolkit.plugin.claude-api"

    public let displayName = "Claude (API)"

    public let capabilities: AIPluginCapability = [.textCompletion, .streaming]

    public let availableModels = [
        "claude-haiku-4-5-20251001",
        "claude-sonnet-4-6",
        "claude-opus-4-6",
    ]

    public let recommendedModel = "claude-haiku-4-5-20251001"

    public let requiresAPIKey = true

    private let context: AIPluginContext

    public required init(context: AIPluginContext) {
        self.context = context
    }

    public func sendMessages(
        _ messages: [AIPluginMessage],
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        credentials: AIPluginCredentials
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    let request = try self.buildRequest(
                        messages: messages, model: model, systemPrompt: systemPrompt,
                        maxTokens: maxTokens, credentials: credentials, stream: true
                    )
                    try await Self.streamSSE(request: request, continuation: continuation)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    @MainActor
    public func settingsPanelViewController() -> SettingsPanelViewController? {
        ClaudeAPISettingsPanelViewController(plugin: self)
    }

    public func validateCredentials(_ credentials: AIPluginCredentials) async -> String? {
        do {
            let messages = [AIPluginMessage(role: .user, content: "Hi")]
            let request = try buildRequest(
                messages: messages, model: recommendedModel, systemPrompt: nil,
                maxTokens: 1, credentials: credentials, stream: false
            )

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return "Invalid response" }
            if http.statusCode == 200 || http.statusCode == 201 { return nil }
            let body = String(data: data, encoding: .utf8) ?? ""
            return Self.parseErrorMessage(from: body) ?? "HTTP \(http.statusCode)"
        } catch {
            return error.localizedDescription
        }
    }

    // MARK: - Request Building

    private func buildRequest(
        messages: [AIPluginMessage],
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        credentials: AIPluginCredentials,
        stream: Bool
    ) throws -> URLRequest {
        guard let url = URL(string: "https://api.anthropic.com/v1/messages") else {
            preconditionFailure("Anthropic messages URL literal is invalid")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(credentials.apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.timeoutInterval = 120

        let apiMessages = messages.filter { $0.role != .system }.map { msg -> [String: String] in
            ["role": msg.role.rawValue, "content": msg.content]
        }

        var body: [String: Any] = [
            "model": model.isEmpty ? recommendedModel : model,
            "max_tokens": maxTokens > 0 ? maxTokens : 4096,
            "messages": apiMessages,
            "stream": stream,
        ]
        if let systemPrompt, !systemPrompt.isEmpty {
            body["system"] = systemPrompt
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }

    // MARK: - SSE Streaming

    /// Streams the Anthropic Messages API response using Server-Sent Events.
    /// Parses `content_block_delta` events and yields `delta.text` chunks.
    private static func streamSSE(
        request: URLRequest,
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async throws {
        let (bytes, response) = try await URLSession.shared.bytes(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw AIPluginRequestError.invalidResponse
        }

        // Non-2xx: read the full body for the error message
        guard (200...299).contains(http.statusCode) else {
            var errorBody = ""
            for try await line in bytes.lines {
                errorBody += line
            }
            let message = parseErrorMessage(from: errorBody)
            throw AIPluginRequestError.httpError(http.statusCode, message)
        }

        // Parse SSE: each event is prefixed with "data: "
        for try await line in bytes.lines {
            guard line.hasPrefix("data: ") else { continue }
            let payload = String(line.dropFirst(6))

            if payload == "[DONE]" { break }

            guard let data = payload.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let eventType = json["type"] as? String else {
                continue
            }

            switch eventType {
            case "content_block_delta":
                if let delta = json["delta"] as? [String: Any],
                   let text = delta["text"] as? String {
                    continuation.yield(text)
                }
            case "error":
                if let error = json["error"] as? [String: Any],
                   let message = error["message"] as? String {
                    throw AIPluginRequestError.httpError(0, message)
                }
            default:
                break
            }
        }
    }

    // MARK: - Error Parsing

    private static func parseErrorMessage(from body: String) -> String? {
        guard let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let error = json["error"] as? [String: Any],
              let message = error["message"] as? String else {
            return nil
        }
        return message
    }
}

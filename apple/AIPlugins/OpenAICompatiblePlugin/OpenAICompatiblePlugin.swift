import AppKit
import Foundation
import os
import AgenticToolkitAIPluginsCore
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow

/// LLM plugin for OpenAI-compatible API endpoints (e.g. self-hosted, LM Studio, etc.).
/// Provides a custom settings view with a base URL text field.
public final class OpenAICompatiblePlugin: NSObject, AgenticLLMPlugin, @unchecked Sendable {

    public static let identifier = "com.agentictoolkit.plugin.openai-compatible"

    public let displayName = "Custom (OpenAI-compatible)"

    public let capabilities: PluginCapability = [.textCompletion]

    public let availableModels: [String] = []

    public let recommendedModel = ""

    public let requiresAPIKey = true

    private let context: PluginContext

    public required init(context: PluginContext) {
        self.context = context
    }

    public func sendMessages(
        _ messages: [LLMMessage],
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        credentials: PluginCredentials
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            Task {
                do {
                    guard let baseURL = credentials.baseURL, !baseURL.isEmpty else {
                        throw PluginRequestError.missingBaseURL
                    }
                    let request = try self.buildRequest(
                        messages: messages, model: model, systemPrompt: systemPrompt,
                        maxTokens: maxTokens, credentials: credentials, baseURL: baseURL
                    )
                    let (data, response) = try await URLSession.shared.data(for: request)

                    guard let http = response as? HTTPURLResponse else {
                        throw PluginRequestError.invalidResponse
                    }
                    guard http.statusCode == 200 || http.statusCode == 201 else {
                        let body = String(data: data, encoding: .utf8) ?? ""
                        throw PluginRequestError.httpError(http.statusCode, OpenAIResponseParser.parseErrorMessage(from: body))
                    }

                    let reply = OpenAIResponseParser.parseReply(from: data)
                    continuation.yield(reply)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    @MainActor
    public func settingsPanelViewController() -> (any SettingsPanelViewController)? {
        OpenAICompatibleSettingsPanelViewController(plugin: self)
    }

    public func validateCredentials(_ credentials: PluginCredentials) async -> String? {
        guard let baseURL = credentials.baseURL, !baseURL.isEmpty else {
            return "Base URL is required for custom endpoints"
        }
        do {
            let messages = [LLMMessage(role: .user, content: "Hi")]
            let request = try buildRequest(
                messages: messages, model: "", systemPrompt: nil,
                maxTokens: 1, credentials: credentials, baseURL: baseURL
            )
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return "Invalid response" }
            if http.statusCode == 200 || http.statusCode == 201 { return nil }
            let body = String(data: data, encoding: .utf8) ?? ""
            return OpenAIResponseParser.parseErrorMessage(from: body) ?? "HTTP \(http.statusCode)"
        } catch {
            return error.localizedDescription
        }
    }

    // MARK: - Private

    private func buildRequest(
        messages: [LLMMessage],
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        credentials: PluginCredentials,
        baseURL: String
    ) throws -> URLRequest {
        guard let url = URL(string: baseURL)?.appendingPathComponent("v1/chat/completions") else {
            throw PluginRequestError.invalidURL
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(credentials.apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.timeoutInterval = 60

        var allMessages: [[String: String]] = []
        if let systemPrompt, !systemPrompt.isEmpty {
            allMessages.append(["role": "system", "content": systemPrompt])
        }
        for msg in messages where msg.role != .system {
            allMessages.append(["role": msg.role.rawValue, "content": msg.content])
        }

        var body: [String: Any] = [
            "max_tokens": maxTokens,
            "messages": allMessages,
        ]
        if !model.isEmpty {
            body["model"] = model
        }

        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }
}

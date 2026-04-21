import AppKit
import Foundation
import os
import AgenticToolkitPluginSDK
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow

/// LLM plugin for the OpenAI Chat Completions API.
public final class OpenAIPlugin: NSObject, AgenticLLMPlugin, @unchecked Sendable {

    public static let identifier = "com.agentictoolkit.plugin.openai"

    public let displayName = "OpenAI (ChatGPT)"

    public let capabilities: PluginCapability = [.textCompletion]

    public let availableModels = [
        "gpt-4.1-nano",
        "gpt-4.1-mini",
        "gpt-4o-mini",
        "gpt-4o",
    ]

    public let recommendedModel = "gpt-4.1-nano"

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
                    let request = try self.buildRequest(
                        messages: messages, model: model, systemPrompt: systemPrompt,
                        maxTokens: maxTokens, credentials: credentials,
                        baseURL: "https://api.openai.com"
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
        OpenAISettingsPanelViewController(plugin: self)
    }

    public func validateCredentials(_ credentials: PluginCredentials) async -> String? {
        do {
            let messages = [LLMMessage(role: .user, content: "Hi")]
            let request = try buildRequest(
                messages: messages, model: recommendedModel, systemPrompt: nil,
                maxTokens: 1, credentials: credentials,
                baseURL: "https://api.openai.com"
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

    // MARK: - Internal (shared with OpenAICompatiblePlugin)

    func buildRequest(
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

        let body: [String: Any] = [
            "model": model.isEmpty ? recommendedModel : model,
            "max_tokens": maxTokens,
            "messages": allMessages,
        ]

        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        return request
    }
}

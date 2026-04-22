import AppKit
import Foundation
import os
import AgenticToolkitCoreUI
import AgenticToolkitSettingsWindow
import AgenticToolkitAIPlugins

/// LLM plugin for the Google Gemini `generateContent` API.
public final class GooglePlugin: NSObject, AIPlugin, @unchecked Sendable {

    public static let identifier = "com.agentictoolkit.plugin.google"

    public let displayName = "Google (Gemini)"

    public let capabilities: AIPluginCapability = [.textCompletion]

    public let availableModels = [
        "gemini-2.0-flash",
        "gemini-2.5-flash-preview-05-20",
        "gemini-2.5-pro-preview-05-06",
    ]

    public let recommendedModel = "gemini-2.0-flash"

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
                        maxTokens: maxTokens, credentials: credentials
                    )
                    let (data, response) = try await URLSession.shared.data(for: request)

                    guard let http = response as? HTTPURLResponse else {
                        throw AIPluginRequestError.invalidResponse
                    }
                    guard http.statusCode == 200 || http.statusCode == 201 else {
                        let body = String(data: data, encoding: .utf8) ?? ""
                        throw AIPluginRequestError.httpError(http.statusCode, Self.parseErrorMessage(from: body))
                    }

                    let reply = Self.parseReply(from: data)
                    continuation.yield(reply)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    @MainActor
    public func settingsPanelViewController() -> SettingsPanelViewController? {
        GoogleSettingsPanelViewController(plugin: self)
    }

    public func validateCredentials(_ credentials: AIPluginCredentials) async -> String? {
        do {
            let messages = [AIPluginMessage(role: .user, content: "Hi")]
            let request = try buildRequest(
                messages: messages, model: recommendedModel, systemPrompt: nil,
                maxTokens: 1, credentials: credentials
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

    // MARK: - Private

    private func buildRequest(
        messages: [AIPluginMessage],
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        credentials: AIPluginCredentials
    ) throws -> URLRequest {
        let effectiveModel = model.isEmpty ? recommendedModel : model
        var components = URLComponents()
        components.scheme = "https"
        components.host = "generativelanguage.googleapis.com"
        components.path = "/v1beta/models/\(effectiveModel):generateContent"
        components.queryItems = [URLQueryItem(name: "key", value: credentials.apiKey)]
        guard let url = components.url else {
            throw AIPluginRequestError.invalidResponse
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.timeoutInterval = 60

        let contents = messages.filter { $0.role != .system }.map { msg -> [String: Any] in
            let role = msg.role == .assistant ? "model" : "user"
            return ["role": role, "parts": [["text": msg.content]]]
        }

        var body: [String: Any] = [
            "contents": contents,
            "generationConfig": ["maxOutputTokens": maxTokens],
        ]
        if let systemPrompt, !systemPrompt.isEmpty {
            body["systemInstruction"] = ["parts": [["text": systemPrompt]]]
        }

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        return request
    }

    private static func parseReply(from data: Data) -> String {
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let candidates = json["candidates"] as? [[String: Any]],
              let first = candidates.first,
              let content = first["content"] as? [String: Any],
              let parts = content["parts"] as? [[String: Any]],
              let firstPart = parts.first,
              let text = firstPart["text"] as? String else {
            return "(Unable to parse response)"
        }
        return text
    }

    private static func parseErrorMessage(from body: String) -> String? {
        guard let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        if let error = json["error"] as? [String: Any], let message = error["message"] as? String {
            return message
        }
        return nil
    }
}

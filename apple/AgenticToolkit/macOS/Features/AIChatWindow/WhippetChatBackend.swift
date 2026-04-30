import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

import Foundation

/// A `ChatBackend` that dispatches to the provider configured in `WhippetSettingsViewModel`.
/// Routes to the Claude CLI when `aiProvider.usesCLI`, otherwise uses `AIRequestBuilder`
/// to build a provider-specific HTTP request.
@MainActor
public class WhippetChatBackend: ChatBackend {

    public var aiInfo: AIModelChatConfig

    public init(aiInfo: AIModelChatConfig) {
        self.aiInfo = aiInfo
    }

    // MARK: - ChatBackend

    public var isReady: Bool { true }

    public nonisolated func isReadyChanges() -> AsyncStream<Bool> {
        AsyncStream { continuation in
            continuation.yield(true)
            continuation.finish()
        }
    }

    public func sendMessages(_ messages: [ChatBackendMessage]) async -> AsyncThrowingStream<String, Error> {
        let provider = aiInfo.aiProvider
        let model = aiInfo.aiModel
        let baseURL = aiInfo.aiBaseURL
        let summariesEnabled = aiInfo.aiSummariesEnabled
        // Read the API key on the MainActor (where SettingsStore lives) before
        // hopping into the detached task, which is non-isolated.
        let apiKey = aiInfo.apiKey

        return AsyncThrowingStream { continuation in
            Task.detached(priority: .userInitiated) {
                do {
                    let reply: String
                    if provider.usesCLI {
                        let prompt = messages.last(where: { $0.role == .user })?.content ?? ""
                        reply = try await Self.runClaudeCLI(prompt: prompt, model: model)
                    } else {
                        guard summariesEnabled else {
                            throw WhippetChatBackendError.featuresDisabled
                        }
                        guard !apiKey.isEmpty else {
                            throw WhippetChatBackendError.missingAPIKey
                        }
                        reply = try await Self.runAPIRequest(
                            provider: provider, model: model, apiKey: apiKey,
                            baseURL: baseURL, messages: messages
                        )
                    }
                    continuation.yield(reply)
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    // MARK: - API Dispatch

    private static func runAPIRequest(
        provider: AIProvider,
        model: String,
        apiKey: String,
        baseURL: String,
        messages: [ChatBackendMessage]
    ) async throws -> String {
        let apiMessages = messages.map { msg -> [String: String] in
            let role: String
            switch msg.role {
            case .user: role = "user"
            case .assistant: role = "assistant"
            case .system: role = "system"
            }
            return ["role": role, "content": msg.content]
        }

        let config = AIRequestConfig(
            provider: provider, model: model, apiKey: apiKey,
            customBaseURL: baseURL, maxTokens: 256, timeoutInterval: 30
        )
        let request = try AIRequestBuilder.buildRequest(config: config, messages: apiMessages)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw AIRequestError.invalidResponse
        }
        guard http.statusCode == 200 || http.statusCode == 201 else {
            let body = String(data: data, encoding: .utf8) ?? ""
            throw WhippetChatBackendError.httpError(
                AIRequestBuilder.parseErrorMessage(from: body, statusCode: http.statusCode)
            )
        }
        return AIRequestBuilder.parseAssistantReply(from: data, provider: provider)
    }

    // MARK: - Claude CLI

    private static func runClaudeCLI(prompt: String, model: String) async throws -> String {
        guard let claudePath = findClaudeBinary() else {
            throw WhippetChatBackendError.cliNotFound
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: claudePath)
        var args = ["-p"]
        if !model.isEmpty {
            args += ["--model", model]
        }
        process.arguments = args

        let stdinPipe = Pipe()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardInput = stdinPipe
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        var env = ProcessInfo.processInfo.environment
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        let extraPaths = [
            "\(homeDir)/.local/bin",
            "/usr/local/bin",
            "/opt/homebrew/bin"
        ]
        let existingPath = env["PATH"] ?? "/usr/bin:/bin"
        env["PATH"] = (extraPaths + [existingPath]).joined(separator: ":")
        process.environment = env

        try process.run()

        stdinPipe.fileHandleForWriting.write(Data(prompt.utf8))
        stdinPipe.fileHandleForWriting.closeFile()

        let timeoutTask = Task {
            try await Task.sleep(for: .seconds(30))
            if process.isRunning { process.terminate() }
        }

        process.waitUntilExit()
        timeoutTask.cancel()

        let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
        let reply = String(data: stdoutData, encoding: .utf8)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let errorOutput = String(data: stderrData, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        guard process.terminationStatus == 0 else {
            let msg = errorOutput.isEmpty ? "Exit code \(process.terminationStatus)" : errorOutput
            throw WhippetChatBackendError.cliFailed(String(msg.prefix(200)))
        }

        guard !reply.isEmpty else {
            throw WhippetChatBackendError.emptyReply
        }

        return reply
    }

    private static func findClaudeBinary() -> String? {
        let candidates = [
            FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".local/bin/claude").path,
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude"
        ]
        for path in candidates where FileManager.default.isExecutableFile(atPath: path) {
            return path
        }
        return nil
    }
}

// MARK: - Errors

public enum WhippetChatBackendError: Error, LocalizedError {
    case cliNotFound
    case cliFailed(String)
    case emptyReply
    case missingAPIKey
    case featuresDisabled
    case httpError(String)

    public var errorDescription: String? {
        switch self {
        case .cliNotFound: return "Claude CLI not found. Install Claude Code or check your PATH."
        case .cliFailed(let msg): return "claude -p failed: \(msg)"
        case .emptyReply: return "Empty reply from Claude CLI"
        case .missingAPIKey: return "No API key configured."
        case .featuresDisabled: return "AI features are disabled — enable them in Settings."
        case .httpError(let msg): return msg
        }
    }
}

import Foundation
import os
import AgenticPluginSDK
import CoreUI
import SettingsWindow

/// LLM plugin that runs Claude locally via the Claude Code CLI (`claude -p`).
/// Uses the user's existing Claude Code installation — no API key required.
/// Streams output incrementally as the subprocess produces it.
public final class ClaudeLocalPlugin: NSObject, AgenticLLMPlugin, @unchecked Sendable {

    public static let identifier = "com.agentictoolkit.plugin.claude-local"

    public let displayName = "Claude (Local)"

    public let capabilities: PluginCapability = [.textCompletion, .streaming]

    public let availableModels = ["haiku", "sonnet", "opus"]

    public let recommendedModel = "haiku"

    public let requiresAPIKey = false

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
        // claude -p is single-shot: stdin is the user prompt.
        // Build a combined prompt from the full conversation history.
        let prompt = Self.buildPrompt(messages: messages)

        return AsyncThrowingStream { continuation in
            Task {
                do {
                    try await Self.stream(
                        prompt: prompt,
                        model: model,
                        systemPrompt: systemPrompt,
                        maxTokens: maxTokens,
                        continuation: continuation
                    )
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
        }
    }

    @MainActor
    public func settingsPanelViewController() -> (any SettingsPanelViewController)? {
        ClaudeLocalSettingsPanelViewController(plugin: self)
    }

    // MARK: - Prompt Assembly

    /// Builds a prompt string from message history.
    /// For multi-turn conversations, formats prior turns so Claude sees the full context.
    /// Single messages are passed through directly.
    private static func buildPrompt(messages: [LLMMessage]) -> String {
        let nonSystem = messages.filter { $0.role != .system }
        guard nonSystem.count > 1 else {
            return nonSystem.last?.content ?? ""
        }
        // Multi-turn: format as conversation so Claude understands the history
        return nonSystem.map { msg in
            switch msg.role {
            case .user:      return "Human: \(msg.content)"
            case .assistant: return "Assistant: \(msg.content)"
            case .system:    return msg.content
            @unknown default: return msg.content
            }
        }.joined(separator: "\n\n")
    }

    // MARK: - Subprocess Streaming

    private static func stream(
        prompt: String,
        model: String,
        systemPrompt: String?,
        maxTokens: Int,
        continuation: AsyncThrowingStream<String, Error>.Continuation
    ) async throws {
        guard let claudePath = findClaudeBinary() else {
            throw CLIError.notFound
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: claudePath)

        var args = ["-p", "--output-format", "text"]
        if !model.isEmpty { args += ["--model", model] }
        if let system = systemPrompt, !system.isEmpty {
            args += ["--system-prompt", system]
        }
        if maxTokens > 0 { args += ["--max-turns", "1"] }
        process.arguments = args

        let stdinPipe  = Pipe()
        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardInput  = stdinPipe
        process.standardOutput = stdoutPipe
        process.standardError  = stderrPipe

        var env = ProcessInfo.processInfo.environment
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        env["PATH"] = (["\(home)/.local/bin", "/usr/local/bin", "/opt/homebrew/bin"]
            + [env["PATH"] ?? "/usr/bin:/bin"]).joined(separator: ":")
        process.environment = env

        // Read stdout incrementally via an AsyncStream bridge
        let (chunks, chunksCont) = AsyncStream<Data>.makeStream()
        stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
            let data = handle.availableData
            if data.isEmpty {
                stdoutPipe.fileHandleForReading.readabilityHandler = nil
                chunksCont.finish()
            } else {
                chunksCont.yield(data)
            }
        }

        try process.run()
        stdinPipe.fileHandleForWriting.write(Data(prompt.utf8))
        stdinPipe.fileHandleForWriting.closeFile()

        let timeoutTask = Task {
            try? await Task.sleep(for: .seconds(60))
            if process.isRunning { process.terminate() }
        }

        var receivedAny = false
        for await chunk in chunks {
            if let text = String(data: chunk, encoding: .utf8), !text.isEmpty {
                receivedAny = true
                continuation.yield(text)
            }
        }

        timeoutTask.cancel()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let errData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            let errMsg = String(data: errData, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            throw CLIError.failed(errMsg.isEmpty
                ? "Exit code \(process.terminationStatus)"
                : String(errMsg.prefix(200)))
        }

        if !receivedAny {
            throw CLIError.emptyReply
        }
    }

    private static func findClaudeBinary() -> String? {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = ["\(home)/.local/bin/claude", "/usr/local/bin/claude", "/opt/homebrew/bin/claude"]
        return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    // MARK: - Errors

    private enum CLIError: Error, LocalizedError {
        case notFound
        case failed(String)
        case emptyReply

        var errorDescription: String? {
            switch self {
            case .notFound:        return "Claude CLI not found. Install Claude Code or check your PATH."
            case .failed(let msg): return "claude -p failed: \(msg)"
            case .emptyReply:      return "Claude returned an empty reply."
            }
        }
    }
}

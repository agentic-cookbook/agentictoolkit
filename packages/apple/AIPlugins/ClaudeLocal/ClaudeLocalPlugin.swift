import Foundation
import AIPluginKit

/// LLM plugin that runs Claude locally via the Claude Code CLI (`claude -p`).
///
/// Uses the user's existing Claude Code installation — no API key. Foundation-only:
/// it describes a *command* request (the CLI invocation plus the prompt on stdin)
/// and decodes the plain-text stdout. The host owns the subprocess transport.
public final class ClaudeLocalPlugin: NSObject, AIPlugin, @unchecked Sendable {

    public override init() { super.init() }

    public func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
        guard let claudePath = Self.findClaudeBinary() else {
            throw PluginError.notFound
        }

        var arguments = ["-p", "--output-format", "text"]
        if !context.model.isEmpty { arguments += ["--model", context.model] }
        if let systemPrompt = context.systemPrompt, !systemPrompt.isEmpty {
            arguments += ["--system-prompt", systemPrompt]
        }
        arguments += ["--max-turns", "1"]

        let prompt = Self.buildPrompt(messages: context.messages)

        var environment = ProcessInfo.processInfo.environment
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let searchPaths = ["\(home)/.local/bin", "/usr/local/bin", "/opt/homebrew/bin"]
        environment["PATH"] = (searchPaths + [environment["PATH"] ?? "/usr/bin:/bin"]).joined(separator: ":")

        return .command(
            executableURL: URL(fileURLWithPath: claudePath),
            arguments: arguments,
            stdin: Data(prompt.utf8),
            environment: environment
        )
    }

    public func makeDecoder() -> any AIStreamDecoder { PlainTextDecoder() }

    public func describeError(status: Int, body: Data) -> String? {
        let message = String(data: body, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !message.isEmpty else { return nil }
        return "claude -p failed: \(String(message.prefix(200)))"
    }

    // MARK: - Prompt assembly

    /// Builds a single prompt string from the conversation. A single user turn is
    /// passed through verbatim; multi-turn history is formatted so the CLI sees
    /// the full context.
    private static func buildPrompt(messages: [AIChatMessage]) -> String {
        let nonSystem = messages.filter { $0.role != .system }
        guard nonSystem.count > 1 else {
            return nonSystem.last?.content ?? ""
        }
        return nonSystem.map { message in
            switch message.role {
            case .user: return "Human: \(message.content)"
            case .assistant: return "Assistant: \(message.content)"
            case .system: return message.content
            case .toolUse: return "Assistant tool call: \(message.toolName ?? "")"
            case .toolResult: return "Tool result: \(message.content)"
            }
        }.joined(separator: "\n\n")
    }

    private static func findClaudeBinary() -> String? {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let candidates = ["\(home)/.local/bin/claude", "/usr/local/bin/claude", "/opt/homebrew/bin/claude"]
        return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    enum PluginError: Error, LocalizedError {
        case notFound

        var errorDescription: String? {
            switch self {
            case .notFound: return "Claude CLI not found. Install Claude Code or check your PATH."
            }
        }
    }
}

/// Emits each chunk of the CLI's plain-text stdout as a text delta. The CLI's
/// `--output-format text` mode writes the reply directly, so no parsing is needed.
final class PlainTextDecoder: AIStreamDecoder {

    func consume(_ data: Data) -> [AIStreamEvent] {
        guard let text = String(data: data, encoding: .utf8), !text.isEmpty else { return [] }
        return [.textDelta(text)]
    }

    func finish() -> [AIStreamEvent] { [.end(stopReason: nil)] }
}

import AgenticToolkitCoreMacOS
import AgenticToolkitCore
import Foundation
import os

/// Generates AI-powered summaries for Claude Code sessions by reading stored events
/// and sending a summarization prompt to the configured AI provider.
public final class SessionSummarizer: @unchecked Sendable {

    // MARK: - Properties

    private let sessionsDatabaseManager: SessionsDatabaseManager

    /// Approximate character budget for the events portion of the prompt.
    public static let defaultEventCharBudget = 3_000

    /// Maximum tokens for the summary output.
    public static let summaryMaxTokens = 64

    /// Timeout for the summarization API call.
    public static let requestTimeout: TimeInterval = 60

    private static let systemPrompt = """
        Summarize this coding session in 4-8 simple words. \
        Start with a verb ending in -ing. Be brief and plain. \
        No jargon, no technical details, no explanations. \
        Examples: "fixing the sessions window UI", \
        "adding keyboard shortcuts", \
        "cleaning up old code", \
        "improving how summaries look". \
        Output only the short phrase, nothing else.
        """

    // MARK: - Initialization

    public init(sessionsDatabaseManager: SessionsDatabaseManager) {
        self.sessionsDatabaseManager = sessionsDatabaseManager
    }

    // MARK: - Public API

    /// Errors that can occur during summarization.
    public enum SummarizerError: Error, LocalizedError {
        case disabled
        case noAPIKey
        case sessionNotFound(String)
        case noEvents
        case apiError(String)
        case invalidResponse
        case emptyReply

        public var errorDescription: String? {
            switch self {
            case .disabled: return "AI summaries not enabled"
            case .noAPIKey: return "No API key configured"
            case .sessionNotFound(let id): return "Session not found: \(id)"
            case .noEvents: return "No events for this session"
            case .apiError(let msg): return msg
            case .invalidResponse: return "Invalid response from API"
            case .emptyReply: return "Empty reply from API"
            }
        }

        /// Whether this error is fatal and should stop the summarization loop.
        /// Config/API errors are fatal; missing data is not.
        var isFatal: Bool {
            switch self {
            case .noAPIKey, .apiError, .invalidResponse:
                return true
            case .disabled, .sessionNotFound, .noEvents, .emptyReply:
                return false
            }
        }
    }

    /// Summarizes a session by reading all its events from the database,
    /// building a prompt, and calling the configured AI provider.
    /// Throws `SummarizerError` on failure.
    public func summarize(sessionId: String) async throws -> String {
        // Check if enabled before any logging
        let enabledStr = try? sessionsDatabaseManager.getSetting(key: "ai_summaries_enabled")
        guard enabledStr == "true" else {
            throw SummarizerError.disabled
        }

        let dbg = SessionWatcher.SummarizerDebugLog.shared
        dbg.append("--- summarize(\(sessionId)) called ---")

        let providerStr = (try? sessionsDatabaseManager.getSetting(key: "ai_provider")) ?? "claude_cli"
        let provider = AIProvider(rawValue: providerStr) ?? .anthropic
        let model = (try? sessionsDatabaseManager.getSetting(key: "ai_model")) ?? provider.recommendedModel
        dbg.append("Provider: \(provider.rawValue), Model: \(model)")

        // Fetch session and events
        guard let session = try? sessionsDatabaseManager.fetchSession(bySessionId: sessionId) else {
            dbg.append("BAIL: Session not found in database")
            throw SummarizerError.sessionNotFound(sessionId)
        }
        dbg.append("Session found: project=\(session.projectName), status=\(session.status.rawValue)")

        let events: [SessionEvent]
        do {
            events = try sessionsDatabaseManager.fetchEvents(forSessionId: sessionId)
        } catch {
            dbg.append("BAIL: Failed to fetch events — \(error.localizedDescription)")
            throw SummarizerError.apiError("Failed to fetch events: \(error.localizedDescription)")
        }
        dbg.append("Fetched \(events.count) events")

        guard !events.isEmpty else {
            dbg.append("BAIL: No events for this session")
            throw SummarizerError.noEvents
        }

        // Build prompt
        let userMessage = buildSummarizationPrompt(session: session, events: events)
        dbg.append("--- PROMPT (\(userMessage.count) chars) ---")
        dbg.append(userMessage)
        dbg.append("--- END PROMPT ---")

        // Route to CLI or API based on provider
        if provider.usesCLI {
            return try await summarizeViaCLI(
                prompt: userMessage,
                model: model,
                dbg: dbg,
                sessionId: sessionId
            )
        } else {
            return try await summarizeViaAPI(
                prompt: userMessage,
                provider: provider,
                model: model,
                dbg: dbg,
                sessionId: sessionId
            )
        }
    }

    // MARK: - Claude CLI Summarization

    /// Runs `claude -p` with the prompt piped to stdin.
    private func summarizeViaCLI(
        prompt: String,
        model: String,
        dbg: SessionWatcher.SummarizerDebugLog,
        sessionId: String
    ) async throws -> String {
        dbg.append("Using Claude CLI (model: \(model))")

        // Find the claude binary
        let claudePath = Self.findClaudeBinary()
        guard let claudePath else {
            dbg.append("BAIL: claude binary not found in PATH")
            throw SummarizerError.apiError("Claude CLI not found. Install Claude Code or check your PATH.")
        }
        dbg.append("Claude binary: \(claudePath)")

        let process = Process()
        process.executableURL = URL(fileURLWithPath: claudePath)
        var args = ["-p", "--system-prompt", Self.systemPrompt]
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

        // Inherit PATH so claude can find its dependencies
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

        do {
            try process.run()
        } catch {
            dbg.append("BAIL: Failed to launch claude — \(error.localizedDescription)")
            throw SummarizerError.apiError("Failed to launch claude: \(error.localizedDescription)")
        }

        // Write prompt to stdin and close
        stdinPipe.fileHandleForWriting.write(Data(prompt.utf8))
        stdinPipe.fileHandleForWriting.closeFile()

        // Wait for completion (with timeout)
        let timeoutTask = Task {
            try await Task.sleep(for: .seconds(Self.requestTimeout))
            if process.isRunning {
                process.terminate()
            }
        }

        process.waitUntilExit()
        timeoutTask.cancel()

        let stdoutData = stdoutPipe.fileHandleForReading.readDataToEndOfFile()
        let stderrData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
        let reply = String(data: stdoutData, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let errorOutput = String(data: stderrData, encoding: .utf8)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        dbg.append("Exit code: \(process.terminationStatus)")
        if !errorOutput.isEmpty {
            dbg.append("stderr: \(errorOutput.prefix(500))")
        }

        guard process.terminationStatus == 0 else {
            let msg = errorOutput.isEmpty ? "Exit code \(process.terminationStatus)" : errorOutput
            dbg.append("BAIL: claude exited with error")
            throw SummarizerError.apiError("claude -p failed: \(String(msg.prefix(200)))")
        }

        dbg.append("--- REPLY ---")
        dbg.append(reply)
        dbg.append("--- END REPLY ---")

        guard !reply.isEmpty else {
            dbg.append("BAIL: Empty reply")
            throw SummarizerError.emptyReply
        }

        dbg.append("SUCCESS: Summary generated")
        logger.info("Generated summary for \(sessionId, privacy: .public): \(reply.prefix(80), privacy: .public)")
        return reply
    }

    /// Searches common locations for the `claude` binary.
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

    // MARK: - API-based Summarization

    private func summarizeViaAPI(
        prompt: String,
        provider: AIProvider,
        model: String,
        dbg: SessionWatcher.SummarizerDebugLog,
        sessionId: String
    ) async throws -> String {
        let apiKey = KeychainHelper.get(forKey: "ai_api_key") ?? ""
        dbg.append("API key present = \(!apiKey.isEmpty) (length: \(apiKey.count))")
        guard !apiKey.isEmpty else {
            dbg.append("BAIL: No API key in Keychain")
            throw SummarizerError.noAPIKey
        }

        let baseURL = (try? sessionsDatabaseManager.getSetting(key: "ai_base_url")) ?? ""
        dbg.append("BaseURL: \(baseURL.isEmpty ? "(none)" : baseURL)")

        let config = AIRequestConfig(
            provider: provider,
            model: model,
            apiKey: apiKey,
            customBaseURL: baseURL,
            maxTokens: Self.summaryMaxTokens,
            timeoutInterval: Self.requestTimeout
        )

        let request: URLRequest
        do {
            request = try AIRequestBuilder.buildRequest(
                config: config,
                messages: [["role": "user", "content": prompt]],
                systemPrompt: Self.systemPrompt
            )
        } catch {
            dbg.append("BAIL: Failed to build request — \(error.localizedDescription)")
            throw SummarizerError.apiError("Failed to build request: \(error.localizedDescription)")
        }
        dbg.append("Sending request to \(request.url?.host ?? "?") ...")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            dbg.append("BAIL: Request exception — \(error.localizedDescription)")
            throw SummarizerError.apiError("Request failed: \(error.localizedDescription)")
        }

        guard let http = response as? HTTPURLResponse else {
            dbg.append("BAIL: Invalid response (not HTTP)")
            throw SummarizerError.invalidResponse
        }

        dbg.append("HTTP \(http.statusCode)")

        guard http.statusCode == 200 || http.statusCode == 201 else {
            let body = String(data: data, encoding: .utf8) ?? ""
            let message = AIRequestBuilder.parseErrorMessage(from: body, statusCode: http.statusCode)
            dbg.append("BAIL: API error — \(message)")
            dbg.append("Response body: \(body.prefix(500))")
            throw SummarizerError.apiError("HTTP \(http.statusCode): \(message)")
        }

        let reply = AIRequestBuilder.parseAssistantReply(from: data, provider: provider)
        dbg.append("--- REPLY ---")
        dbg.append(reply)
        dbg.append("--- END REPLY ---")

        guard !reply.isEmpty, !reply.starts(with: "(") else {
            dbg.append("BAIL: Empty or error reply")
            throw SummarizerError.emptyReply
        }

        dbg.append("SUCCESS: Summary generated")
        logger.info("Generated summary for \(sessionId, privacy: .public): \(reply.prefix(80), privacy: .public)")
        return reply
    }

    /// Summarizes a session and stores the result in the database.
    /// Throws on fatal errors (API/config), returns silently on non-fatal ones (no events, etc.).
    public func summarizeAndStore(sessionId: String) async throws {
        // Bail early if disabled — no logging at all
        let enabledStr = try? sessionsDatabaseManager.getSetting(key: "ai_summaries_enabled")
        guard enabledStr == "true" else { return }

        SessionWatcher.SummarizerDebugLog.shared.append("summarizeAndStore(\(sessionId)) entered")

        let summary: String
        do {
            summary = try await summarize(sessionId: sessionId)
        } catch let error as SummarizerError where !error.isFatal {
            // swiftlint:disable:next line_length
            logger.debug("Skipping summarization for \(sessionId, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return
        }

        do {
            try sessionsDatabaseManager.updateSessionSummary(
                sessionId: sessionId,
                summary: summary
            )
            logger.info("Stored AI summary for session \(sessionId, privacy: .public)")

            await MainActor.run {
                // Notification fan-out — coupling that ought to live elsewhere.
                SessionWatcher.SessionListViewModel.notifySessionsChanged()
            }
        } catch {
            // swiftlint:disable:next line_length
            logger.error("Failed to store summary for \(sessionId, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Prompt Construction

    /// Builds the user message for summarization from session metadata and events.
    public func buildSummarizationPrompt(session: Session, events: [SessionEvent]) -> String {
        var lines: [String] = []

        lines.append("Project: \(session.projectName)")
        if !session.gitBranch.isEmpty {
            lines.append("Branch: \(session.gitBranch)")
        }

        // Extract user prompts — highest signal for what the session is about
        let userPrompts = events
            .filter { $0.eventType == "UserPromptSubmit" }
            .compactMap { event -> String? in
                let json = Self.parseRawJson(event.rawJson)
                let data = json["data"] as? [String: Any] ?? [:]
                guard let prompt = data["prompt"] as? String, !prompt.isEmpty else { return nil }
                return String(prompt.prefix(200))
            }
            .suffix(5)  // Keep only the 5 most recent

        if !userPrompts.isEmpty {
            lines.append("")
            lines.append("What the user asked:")
            for prompt in userPrompts {
                lines.append("- \"\(prompt)\"")
            }
        }

        // Summarize tool activity pattern instead of listing individual calls
        let toolCounts = Self.countToolActivity(events: events)
        if !toolCounts.isEmpty {
            lines.append("")
            lines.append("Activity: \(toolCounts)")
        }

        return lines.joined(separator: "\n")
    }

    /// Summarizes tool usage into a brief activity description.
    public static func countToolActivity(events: [SessionEvent]) -> String {
        var counts: [String: Int] = [:]
        for event in events where event.eventType == "PreToolUse" {
            let json = parseRawJson(event.rawJson)
            let data = json["data"] as? [String: Any] ?? [:]
            let tool = data["tool"] as? String ?? "unknown"
            counts[tool, default: 0] += 1
        }
        guard !counts.isEmpty else { return "" }

        let sorted = counts.sorted { $0.value > $1.value }.prefix(4)
        let parts = sorted.map { "\($0.key) (\($0.value)x)" }
        return parts.joined(separator: ", ")
    }

    // MARK: - Event Distillation

    /// Reduces a single event's raw JSON to a compact, high-signal line.
    public static func distillEvent(_ event: SessionEvent) -> String {
        let json = parseRawJson(event.rawJson)
        let data = json["data"] as? [String: Any] ?? [:]

        switch event.eventType {
        case "SessionStart":
            let cwd = data["cwd"] as? String ?? ""
            let model = data["model"] as? String ?? ""
            return "[SessionStart] cwd=\(cwd) model=\(model)"

        case "SessionEnd":
            let reason = data["reason"] as? String ?? ""
            return "[SessionEnd] reason=\(reason)"

        case "UserPromptSubmit":
            let prompt = data["prompt"] as? String ?? ""
            let truncated = String(prompt.prefix(500))
            return "[UserPrompt] \"\(truncated)\""

        case "PreToolUse":
            let tool = data["tool"] as? String ?? "unknown"
            let input = compactToolInput(data["tool_input"])
            return "[Tool:\(tool)] \(input)"

        case "PostToolUse":
            let tool = data["tool"] as? String ?? "unknown"
            let responseSize = estimateSize(data["tool_response"])
            return "[Tool:\(tool) result] (\(responseSize))"

        case "SubagentStart":
            let agentType = data["agent_type"] as? String ?? ""
            return "[SubagentStart] type=\(agentType)"

        case "SubagentStop":
            let agentType = data["agent_type"] as? String ?? ""
            return "[SubagentStop] type=\(agentType)"

        case "Notification":
            let message = data["message"] as? String ?? ""
            return "[Notification] \(String(message.prefix(200)))"

        case "Stop":
            return "[Stop]"

        default:
            return "[\(event.eventType)]"
        }
    }

    /// Fits distilled events into the character budget.
    /// Keeps first and last events, omits from the middle if over budget.
    public static func fitEventsToBudget(events: [SessionEvent], charBudget: Int) -> [String] {
        let distilled = events.map { distillEvent($0) }

        let totalChars = distilled.reduce(0) { $0 + $1.count }
        if totalChars <= charBudget {
            return distilled
        }

        // Over budget: keep first half and last half of the budget
        let keepCount = max(4, distilled.count / 3)
        let headCount = min(keepCount, distilled.count)
        let tailCount = min(keepCount, max(0, distilled.count - headCount))

        var result: [String] = []
        result.append(contentsOf: distilled.prefix(headCount))

        let omitted = distilled.count - headCount - tailCount
        if omitted > 0 {
            result.append("[... \(omitted) events omitted ...]")
        }

        if tailCount > 0 {
            result.append(contentsOf: distilled.suffix(tailCount))
        }

        return result
    }

    // MARK: - Helpers

    private static func parseRawJson(_ rawJson: String) -> [String: Any] {
        guard let data = rawJson.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return [:]
        }
        return json
    }

    /// Extracts key fields from tool_input for compact representation.
    private static func compactToolInput(_ input: Any?) -> String {
        guard let dict = input as? [String: Any] else {
            guard let str = input as? String else { return "" }
            return String(str.prefix(200))
        }

        // Common tool input patterns
        if let filePath = dict["file_path"] as? String ?? dict["path"] as? String {
            return "file: \(filePath)"
        }
        if let command = dict["command"] as? String {
            return "cmd: \(String(command.prefix(200)))"
        }
        if let pattern = dict["pattern"] as? String {
            return "pattern: \(String(pattern.prefix(100)))"
        }

        // Fallback: list keys
        let keys = dict.keys.sorted().prefix(5).joined(separator: ", ")
        return "{\(keys)}"
    }

    /// Estimates the display size of a value.
    private static func estimateSize(_ value: Any?) -> String {
        guard let value else { return "empty" }
        let description: String
        if let str = value as? String {
            description = str
        } else if let data = try? JSONSerialization.data(withJSONObject: value) {
            description = String(data: data, encoding: .utf8) ?? ""
        } else {
            description = String(describing: value)
        }

        let bytes = description.utf8.count
        if bytes < 1024 {
            return "\(bytes)B"
        } else {
            let kilobytes = Double(bytes) / 1024.0
            return String(format: "%.1fKB", kilobytes)
        }
    }
}

extension SessionSummarizer: Loggable {
    public static nonisolated let logger = makeLogger()
}

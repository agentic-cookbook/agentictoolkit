import Foundation
import os
import AgenticPluginSDK
import AgenticUI

/// Generates AI-powered summaries for Claude Code sessions by reading stored events
/// and sending a summarization prompt to the configured AI plugin.
@MainActor
final class SessionSummarizer {

    // MARK: - Properties

    private let databaseManager: DatabaseManager
    private let pluginManager: PluginManager

    /// Maximum tokens for the summary output.
    static let summaryMaxTokens = 64

    /// Timeout for the summarization API call.
    static let requestTimeout: TimeInterval = 60

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

    init(databaseManager: DatabaseManager, pluginManager: PluginManager) {
        self.databaseManager = databaseManager
        self.pluginManager = pluginManager
    }

    // MARK: - Public API

    /// Errors that can occur during summarization.
    enum SummarizerError: Error, LocalizedError {
        case disabled
        case noAPIKey
        case noPlugin
        case sessionNotFound(String)
        case noEvents
        case apiError(String)
        case invalidResponse
        case emptyReply

        var errorDescription: String? {
            switch self {
            case .disabled: return "AI summaries not enabled"
            case .noAPIKey: return "No API key configured"
            case .noPlugin: return "No AI plugin available"
            case .sessionNotFound(let id): return "Session not found: \(id)"
            case .noEvents: return "No events for this session"
            case .apiError(let msg): return msg
            case .invalidResponse: return "Invalid response from API"
            case .emptyReply: return "Empty reply from API"
            }
        }

        /// Whether this error is fatal and should stop the summarization loop.
        var isFatal: Bool {
            switch self {
            case .noAPIKey, .noPlugin, .apiError, .invalidResponse:
                return true
            case .disabled, .sessionNotFound, .noEvents, .emptyReply:
                return false
            }
        }
    }

    /// Summarizes a session by reading all its events from the database,
    /// building a prompt, and calling the configured AI plugin.
    func summarize(sessionId: String) async throws -> String {
        // Check if enabled before any logging
        let enabledStr = try? databaseManager.getSetting(key: AISettingsViewModel.enabledKey)
        guard enabledStr == "true" else {
            throw SummarizerError.disabled
        }

        let dbg = SummarizerDebugLog.shared
        dbg.append("--- summarize(\(sessionId)) called ---")

        // DB key is "ai_provider" (mapped from AISettingsViewModel.pluginKey by DatabaseManagerPersistence)
        let pluginIdentifier = (try? databaseManager.getSetting(key: "ai_provider")) ?? "com.agentictoolkit.plugin.claude-local"

        guard let plugin = pluginManager.plugin(for: pluginIdentifier) else {
            dbg.append("BAIL: No plugin found for identifier '\(pluginIdentifier)'")
            throw SummarizerError.noPlugin
        }

        let model = (try? databaseManager.getSetting(key: AISettingsViewModel.modelKey)) ?? plugin.recommendedModel
        dbg.append("Plugin: \(plugin.displayName), Model: \(model)")

        // Fetch session and events
        guard let session = try? databaseManager.fetchSession(bySessionId: sessionId) else {
            dbg.append("BAIL: Session not found in database")
            throw SummarizerError.sessionNotFound(sessionId)
        }
        dbg.append("Session found: project=\(session.projectName), status=\(session.status.rawValue)")

        let events: [SessionEvent]
        do {
            events = try databaseManager.fetchEvents(forSessionId: sessionId)
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

        // Get credentials
        let apiKey = plugin.requiresAPIKey
            ? (KeychainHelper.get(forKey: AISettingsViewModel.apiKeyKeychainKey) ?? "")
            : ""
        if plugin.requiresAPIKey && apiKey.isEmpty {
            dbg.append("BAIL: No API key in Keychain")
            throw SummarizerError.noAPIKey
        }

        let baseURL = (try? databaseManager.getSetting(key: AISettingsViewModel.baseURLKey)) ?? ""
        let creds = PluginCredentials(apiKey: apiKey, baseURL: baseURL.isEmpty ? nil : baseURL)

        // Send via plugin and collect the full response
        let messages = [LLMMessage(role: .user, content: userMessage)]
        let stream = plugin.sendMessages(messages, model: model, systemPrompt: Self.systemPrompt, maxTokens: Self.summaryMaxTokens, credentials: creds)

        var reply = ""
        do {
            for try await chunk in stream {
                reply += chunk
            }
        } catch {
            dbg.append("BAIL: Stream error — \(error.localizedDescription)")
            throw SummarizerError.apiError(error.localizedDescription)
        }

        reply = reply.trimmingCharacters(in: .whitespacesAndNewlines)

        dbg.append("--- REPLY ---")
        dbg.append(reply)
        dbg.append("--- END REPLY ---")

        guard !reply.isEmpty else {
            dbg.append("BAIL: Empty reply")
            throw SummarizerError.emptyReply
        }

        dbg.append("SUCCESS: Summary generated")
        Log.ai.info("Generated summary for \(sessionId, privacy: .public): \(reply.prefix(80), privacy: .public)")
        return reply
    }

    /// Summarizes a session and stores the result in the database.
    /// Throws on fatal errors (API/config), returns silently on non-fatal ones (no events, etc.).
    func summarizeAndStore(sessionId: String) async throws {
        // Bail early if disabled — no logging at all
        let enabledStr = try? databaseManager.getSetting(key: AISettingsViewModel.enabledKey)
        guard enabledStr == "true" else { return }

        SummarizerDebugLog.shared.append("summarizeAndStore(\(sessionId)) entered")

        let summary: String
        do {
            summary = try await summarize(sessionId: sessionId)
        } catch let error as SummarizerError where !error.isFatal {
            Log.ai.debug("Skipping summarization for \(sessionId, privacy: .public): \(error.localizedDescription, privacy: .public)")
            return
        }

        do {
            try databaseManager.updateSessionSummary(sessionId: sessionId, summary: summary)
            Log.ai.info("Stored AI summary for session \(sessionId, privacy: .public)")
        } catch {
            Log.ai.error("Failed to store summary for \(sessionId, privacy: .public): \(error.localizedDescription, privacy: .public)")
        }
    }

    // MARK: - Prompt Construction

    /// Builds the user message for summarization from session metadata and events.
    func buildSummarizationPrompt(session: Session, events: [SessionEvent]) -> String {
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
    static func countToolActivity(events: [SessionEvent]) -> String {
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
    static func distillEvent(_ event: SessionEvent) -> String {
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
    static func fitEventsToBudget(events: [SessionEvent], charBudget: Int) -> [String] {
        let distilled = events.map { distillEvent($0) }

        let totalChars = distilled.reduce(0) { $0 + $1.count }
        if totalChars <= charBudget {
            return distilled
        }

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

    private static func compactToolInput(_ input: Any?) -> String {
        guard let dict = input as? [String: Any] else {
            guard let str = input as? String else { return "" }
            return String(str.prefix(200))
        }

        if let filePath = dict["file_path"] as? String ?? dict["path"] as? String {
            return "file: \(filePath)"
        }
        if let command = dict["command"] as? String {
            return "cmd: \(String(command.prefix(200)))"
        }
        if let pattern = dict["pattern"] as? String {
            return "pattern: \(String(pattern.prefix(100)))"
        }

        let keys = dict.keys.sorted().prefix(5).joined(separator: ", ")
        return "{\(keys)}"
    }

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
            let kb = Double(bytes) / 1024.0
            return String(format: "%.1fKB", kb)
        }
    }
}

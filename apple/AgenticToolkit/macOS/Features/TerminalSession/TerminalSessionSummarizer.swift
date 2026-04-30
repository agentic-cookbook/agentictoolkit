import AgenticToolkitCore
import Foundation
import os
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
public struct TerminalSessionSummarizationSettings: Sendable {
    public let enabled: Bool
    public let provider: AIProvider
    public let model: String
    public let apiKey: String
    public let customBaseURL: String

    public init(
        enabled: Bool,
        provider: AIProvider,
        model: String,
        apiKey: String,
        customBaseURL: String
    ) {
        self.enabled = enabled
        self.provider = provider
        self.model = model
        self.apiKey = apiKey
        self.customBaseURL = customBaseURL
    }
}

/// Generates AI-powered summaries for terminal sessions by reading the scrollback
/// buffer and sending a summarization prompt to the configured AI provider.
public enum TerminalSessionSummarizer {

    public static let summaryMaxTokens = 32
    public static let requestTimeout: TimeInterval = 60
    public static let minimumLineCount = 5
    public static let minimumCharCount = 100

    private static let systemPrompt = """
        You are observing a terminal session. You will be given the current summary \
        (if any) and recent terminal output. \
        Decide if the user has changed what they are doing (a topic change). \
        If the topic has NOT changed, respond with exactly: UNCHANGED \
        If the topic HAS changed, respond with a new short name (3-8 words) describing \
        what the session is now doing. Think of it like a tab title — concrete and scannable. \
        Examples: "Building React frontend", "Running database migrations", \
        "Debugging auth middleware", "Git rebase onto main". \
        Output ONLY "UNCHANGED" or the new short name. Nothing else.
        """

    /// Summarizes a terminal session. Returns nil if summarization is disabled, unconfigured,
    /// fails, or the topic has not changed.
    public static func summarize(
        session: TerminalSession,
        settings: TerminalSessionSummarizationSettings
    ) async -> String? {
        guard settings.enabled else {
            logger.debug("Skipping summarization — disabled")
            return nil
        }
        guard !settings.apiKey.isEmpty else {
            logger.debug("Skipping summarization — no API key configured")
            return nil
        }

        let terminalText = await MainActor.run { session.recentScrollbackText() }

        let lineCount = terminalText.components(separatedBy: "\n").count
        guard lineCount >= minimumLineCount, terminalText.count >= minimumCharCount else {
            logger.debug(
                "Skipping summarization — insufficient content (\(lineCount) lines, \(terminalText.count) chars)"
            )
            return nil
        }

        let (directory, branch, process, currentSummary) = await MainActor.run {
            (session.currentDirectory, session.gitBranch, session.foregroundProcess, session.summary)
        }

        let userMessage = buildPrompt(
            currentSummary: currentSummary,
            directory: directory,
            gitBranch: branch,
            foregroundProcess: process,
            terminalText: terminalText
        )

        let config = AIRequestConfig(
            provider: settings.provider,
            model: settings.model,
            apiKey: settings.apiKey,
            customBaseURL: settings.customBaseURL,
            maxTokens: summaryMaxTokens,
            timeoutInterval: requestTimeout
        )

        do {
            let request = try AIRequestBuilder.buildRequest(
                config: config,
                messages: [["role": "user", "content": userMessage]],
                systemPrompt: systemPrompt
            )

            let (data, response) = try await URLSession.shared.data(for: request)

            guard let http = response as? HTTPURLResponse else {
                logger.error("Summarization failed — invalid response")
                return nil
            }

            guard http.statusCode == 200 || http.statusCode == 201 else {
                let body = String(data: data, encoding: .utf8) ?? ""
                let message = AIRequestBuilder.parseErrorMessage(from: body, statusCode: http.statusCode)
                logger.error("Summarization failed — HTTP \(http.statusCode): \(message, privacy: .public)")
                return nil
            }

            let reply = AIRequestBuilder.parseAssistantReply(from: data, provider: settings.provider)

            guard !reply.isEmpty, !reply.starts(with: "(") else {
                logger.warning("Summarization returned empty/error reply")
                return nil
            }

            if reply.trimmingCharacters(in: .whitespacesAndNewlines).uppercased() == "UNCHANGED" {
                logger.debug("Topic unchanged — keeping current summary")
                return nil
            }

            logger.info("Topic changed — new summary: \(reply.prefix(80), privacy: .public)")
            return reply
        } catch {
            logger.error("Summarization request failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private static func buildPrompt(
        currentSummary: String?,
        directory: String?,
        gitBranch: String?,
        foregroundProcess: String?,
        terminalText: String
    ) -> String {
        var lines: [String] = []

        if let summary = currentSummary, !summary.isEmpty {
            lines.append("Current summary: \(summary)")
        } else {
            lines.append("Current summary: (none — first summarization)")
        }

        lines.append("")

        if let dir = directory, !dir.isEmpty {
            lines.append("Working directory: \(dir)")
        }
        if let branch = gitBranch, !branch.isEmpty {
            lines.append("Git branch: \(branch)")
        }
        if let process = foregroundProcess, !process.isEmpty {
            lines.append("Foreground process: \(process)")
        }

        lines.append("")
        lines.append("Recent terminal output:")
        lines.append(terminalText)

        return lines.joined(separator: "\n")
    }
}

extension TerminalSessionSummarizer: Loggable {
    public static nonisolated let logger = makeLogger()
}

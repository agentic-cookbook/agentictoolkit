import XCTest
import AgenticPluginSDK
@testable import AgenticToolkit

final class SessionSummarizerTests: XCTestCase {

    // MARK: - Event Distillation

    func testDistillEvent_SessionStart() {
        let event = SessionEvent(
            sessionId: "test-1",
            eventType: "SessionStart",
            rawJson: #"{"event":"SessionStart","session_id":"test-1","data":{"cwd":"/Users/user/project","model":"sonnet"}}"#
        )

        let result = SessionSummarizer.distillEvent(event)
        XCTAssertTrue(result.contains("[SessionStart]"))
        XCTAssertTrue(result.contains("cwd=/Users/user/project"))
        XCTAssertTrue(result.contains("model=sonnet"))
    }

    func testDistillEvent_UserPromptSubmit() {
        let prompt = String(repeating: "a", count: 600)
        let event = SessionEvent(
            sessionId: "test-1",
            eventType: "UserPromptSubmit",
            rawJson: #"{"event":"UserPromptSubmit","session_id":"test-1","data":{"cwd":"/tmp","prompt":"\#(prompt)"}}"#
        )

        let result = SessionSummarizer.distillEvent(event)
        XCTAssertTrue(result.contains("[UserPrompt]"))
        // Should be truncated to 500 chars
        XCTAssertTrue(result.count < 600)
    }

    func testDistillEvent_PreToolUse_WithFilePath() {
        let event = SessionEvent(
            sessionId: "test-1",
            eventType: "PreToolUse",
            rawJson: #"{"event":"PreToolUse","session_id":"test-1","data":{"tool":"Read","tool_input":{"file_path":"/src/main.swift"}}}"#
        )

        let result = SessionSummarizer.distillEvent(event)
        XCTAssertTrue(result.contains("[Tool:Read]"))
        XCTAssertTrue(result.contains("file: /src/main.swift"))
    }

    func testDistillEvent_PostToolUse_ShowsSizeOnly() {
        let longResponse = String(repeating: "x", count: 5000)
        let event = SessionEvent(
            sessionId: "test-1",
            eventType: "PostToolUse",
            rawJson: #"{"event":"PostToolUse","session_id":"test-1","data":{"tool":"Read","tool_response":"\#(longResponse)"}}"#
        )

        let result = SessionSummarizer.distillEvent(event)
        XCTAssertTrue(result.contains("[Tool:Read result]"))
        // Should show size, NOT the full response
        XCTAssertTrue(result.contains("KB") || result.contains("B)"))
        XCTAssertFalse(result.contains(longResponse))
    }

    func testDistillEvent_SessionEnd() {
        let event = SessionEvent(
            sessionId: "test-1",
            eventType: "SessionEnd",
            rawJson: #"{"event":"SessionEnd","session_id":"test-1","data":{"reason":"user_exit"}}"#
        )

        let result = SessionSummarizer.distillEvent(event)
        XCTAssertEqual(result, "[SessionEnd] reason=user_exit")
    }

    func testDistillEvent_Stop() {
        let event = SessionEvent(
            sessionId: "test-1",
            eventType: "Stop",
            rawJson: #"{"event":"Stop","session_id":"test-1","data":{}}"#
        )

        let result = SessionSummarizer.distillEvent(event)
        XCTAssertEqual(result, "[Stop]")
    }

    // MARK: - Budget Fitting

    func testFitEventsToBudget_UnderBudget() {
        let events = (0..<5).map { i in
            SessionEvent(
                sessionId: "s1",
                eventType: "UserPromptSubmit",
                rawJson: #"{"event":"UserPromptSubmit","session_id":"s1","data":{"prompt":"msg \#(i)"}}"#
            )
        }

        let result = SessionSummarizer.fitEventsToBudget(events: events, charBudget: 100_000)
        XCTAssertEqual(result.count, 5)
        XCTAssertFalse(result.contains { $0.contains("omitted") })
    }

    func testFitEventsToBudget_OverBudget() {
        // Create many events that exceed budget
        let events = (0..<100).map { i in
            SessionEvent(
                sessionId: "s1",
                eventType: "UserPromptSubmit",
                rawJson: #"{"event":"UserPromptSubmit","session_id":"s1","data":{"prompt":"\#(String(repeating: "word ", count: 50)) \#(i)"}}"#
            )
        }

        let result = SessionSummarizer.fitEventsToBudget(events: events, charBudget: 1000)
        XCTAssertTrue(result.count < 100)
        XCTAssertTrue(result.contains { $0.contains("omitted") })
    }

    // MARK: - Prompt Construction

    func testBuildSummarizationPrompt_IncludesProjectAndBranch() throws {
        let db = try DatabaseManager(path: temporaryDatabasePath())
        let summarizer = SessionSummarizer(databaseManager: db, pluginManager: PluginManager(searchPaths: []))

        let session = Session(
            sessionId: "s1",
            cwd: "/Users/user/myproject",
            model: "sonnet",
            gitBranch: "feature/login"
        )
        let events = [
            SessionEvent(
                sessionId: "s1",
                eventType: "UserPromptSubmit",
                rawJson: #"{"event":"UserPromptSubmit","session_id":"s1","data":{"prompt":"fix the login bug"}}"#
            ),
        ]

        let prompt = summarizer.buildSummarizationPrompt(session: session, events: events)
        XCTAssertTrue(prompt.contains("Project: myproject"))
        XCTAssertTrue(prompt.contains("Branch: feature/login"))
        XCTAssertTrue(prompt.contains("fix the login bug"))
        // Model should NOT be in the prompt (reduced noise)
        XCTAssertFalse(prompt.contains("Model:"))
    }

    func testBuildSummarizationPrompt_OnlyIncludesUserPrompts() throws {
        let db = try DatabaseManager(path: temporaryDatabasePath())
        let summarizer = SessionSummarizer(databaseManager: db, pluginManager: PluginManager(searchPaths: []))

        let session = Session(sessionId: "s1", cwd: "/Users/user/proj")
        let events = [
            SessionEvent(sessionId: "s1", eventType: "SessionStart",
                         rawJson: #"{"event":"SessionStart","session_id":"s1","data":{"cwd":"/tmp"}}"#),
            SessionEvent(sessionId: "s1", eventType: "PreToolUse",
                         rawJson: #"{"event":"PreToolUse","session_id":"s1","data":{"tool":"Read","tool_input":{"file_path":"/src/main.swift"}}}"#),
            SessionEvent(sessionId: "s1", eventType: "UserPromptSubmit",
                         rawJson: #"{"event":"UserPromptSubmit","session_id":"s1","data":{"prompt":"add tests"}}"#),
        ]

        let prompt = summarizer.buildSummarizationPrompt(session: session, events: events)
        XCTAssertTrue(prompt.contains("What the user asked:"))
        XCTAssertTrue(prompt.contains("add tests"))
        // Should NOT contain raw event timeline format
        XCTAssertFalse(prompt.contains("Event timeline:"))
        XCTAssertFalse(prompt.contains("[SessionStart]"))
    }

    func testBuildSummarizationPrompt_LimitsToFiveMostRecentPrompts() throws {
        let db = try DatabaseManager(path: temporaryDatabasePath())
        let summarizer = SessionSummarizer(databaseManager: db, pluginManager: PluginManager(searchPaths: []))

        let session = Session(sessionId: "s1", cwd: "/Users/user/proj")
        let events = (1...8).map { i in
            SessionEvent(sessionId: "s1", eventType: "UserPromptSubmit",
                         rawJson: #"{"event":"UserPromptSubmit","session_id":"s1","data":{"prompt":"prompt number \#(i)"}}"#)
        }

        let prompt = summarizer.buildSummarizationPrompt(session: session, events: events)
        // Should only include prompts 4-8 (last 5)
        XCTAssertFalse(prompt.contains("prompt number 1"))
        XCTAssertFalse(prompt.contains("prompt number 2"))
        XCTAssertFalse(prompt.contains("prompt number 3"))
        XCTAssertTrue(prompt.contains("prompt number 4"))
        XCTAssertTrue(prompt.contains("prompt number 8"))
    }

    func testBuildSummarizationPrompt_IncludesActivityPattern() throws {
        let db = try DatabaseManager(path: temporaryDatabasePath())
        let summarizer = SessionSummarizer(databaseManager: db, pluginManager: PluginManager(searchPaths: []))

        let session = Session(sessionId: "s1", cwd: "/Users/user/proj")
        let events = [
            SessionEvent(sessionId: "s1", eventType: "PreToolUse",
                         rawJson: #"{"event":"PreToolUse","session_id":"s1","data":{"tool":"Edit"}}"#),
            SessionEvent(sessionId: "s1", eventType: "PreToolUse",
                         rawJson: #"{"event":"PreToolUse","session_id":"s1","data":{"tool":"Edit"}}"#),
            SessionEvent(sessionId: "s1", eventType: "PreToolUse",
                         rawJson: #"{"event":"PreToolUse","session_id":"s1","data":{"tool":"Read"}}"#),
        ]

        let prompt = summarizer.buildSummarizationPrompt(session: session, events: events)
        XCTAssertTrue(prompt.contains("Activity:"))
        XCTAssertTrue(prompt.contains("Edit (2x)"))
        XCTAssertTrue(prompt.contains("Read (1x)"))
    }

    // MARK: - Tool Activity Counting

    func testCountToolActivity_EmptyEvents() {
        let result = SessionSummarizer.countToolActivity(events: [])
        XCTAssertTrue(result.isEmpty)
    }

    func testCountToolActivity_SortedByFrequency() {
        let events = [
            SessionEvent(sessionId: "s1", eventType: "PreToolUse",
                         rawJson: #"{"event":"PreToolUse","session_id":"s1","data":{"tool":"Read"}}"#),
            SessionEvent(sessionId: "s1", eventType: "PreToolUse",
                         rawJson: #"{"event":"PreToolUse","session_id":"s1","data":{"tool":"Edit"}}"#),
            SessionEvent(sessionId: "s1", eventType: "PreToolUse",
                         rawJson: #"{"event":"PreToolUse","session_id":"s1","data":{"tool":"Edit"}}"#),
            SessionEvent(sessionId: "s1", eventType: "PreToolUse",
                         rawJson: #"{"event":"PreToolUse","session_id":"s1","data":{"tool":"Edit"}}"#),
            SessionEvent(sessionId: "s1", eventType: "PostToolUse",
                         rawJson: #"{"event":"PostToolUse","session_id":"s1","data":{"tool":"Read"}}"#),
        ]

        let result = SessionSummarizer.countToolActivity(events: events)
        // Edit should come first (3x vs 1x), PostToolUse should be ignored
        XCTAssertTrue(result.hasPrefix("Edit (3x)"))
        XCTAssertTrue(result.contains("Read (1x)"))
    }

    // MARK: - Helpers

    private func temporaryDatabasePath() -> String {
        let temp = FileManager.default.temporaryDirectory
        return temp.appendingPathComponent("test-summarizer-\(UUID().uuidString).db").path
    }
}

import XCTest
import AgenticToolkitCore
@testable import AIPluginKit
@testable import AgenticToolkitMacOS

final class AIRequestBuilderTests: XCTestCase {

    private func makeConfig(
        provider: AIProvider,
        customBaseURL: String = ""
    ) -> AIRequestConfig {
        AIRequestConfig(
            provider: provider,
            model: "",
            apiKey: "test-key",
            customBaseURL: customBaseURL,
            maxTokens: 128,
            timeoutInterval: 10
        )
    }

    private let messages: [[String: String]] = [["role": "user", "content": "Hello"]]

    func testAnthropicRequestURLAndHeaders() throws {
        let request = try AIRequestBuilder.buildRequest(
            config: makeConfig(provider: .anthropic),
            messages: messages
        )
        XCTAssertEqual(request.url?.absoluteString, "https://api.anthropic.com/v1/messages")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(request.value(forHTTPHeaderField: "x-api-key"), "test-key")
        XCTAssertEqual(request.value(forHTTPHeaderField: "anthropic-version"), "2023-06-01")
    }

    func testOpenAIRequestURLAndAuth() throws {
        let request = try AIRequestBuilder.buildRequest(
            config: makeConfig(provider: .openai),
            messages: messages
        )
        XCTAssertEqual(request.url?.absoluteString, "https://api.openai.com/v1/chat/completions")
        XCTAssertEqual(request.value(forHTTPHeaderField: "Authorization"), "Bearer test-key")
    }

    func testCustomRequiresBaseURL() {
        XCTAssertThrowsError(
            try AIRequestBuilder.buildRequest(
                config: makeConfig(provider: .custom),
                messages: messages
            )
        ) { error in
            guard let aiError = error as? AIRequestError else {
                return XCTFail("Expected AIRequestError, got \(error)")
            }
            XCTAssertEqual(aiError, .missingBaseURL)
        }
    }

    func testCustomUsesProvidedBaseURL() throws {
        let request = try AIRequestBuilder.buildRequest(
            config: makeConfig(provider: .custom, customBaseURL: "https://example.com"),
            messages: messages
        )
        XCTAssertEqual(request.url?.absoluteString, "https://example.com/v1/chat/completions")
    }

    func testParseAnthropicReply() {
        let json = Data("""
        {"content":[{"text":"Hello back","type":"text"}]}
        """.utf8)
        let reply = AIRequestBuilder.parseAssistantReply(from: json, provider: .anthropic)
        XCTAssertEqual(reply, "Hello back")
    }

    func testParseOpenAIReply() {
        let json = Data("""
        {"choices":[{"message":{"role":"assistant","content":"Hi there"}}]}
        """.utf8)
        let reply = AIRequestBuilder.parseAssistantReply(from: json, provider: .openai)
        XCTAssertEqual(reply, "Hi there")
    }

    func testParseGoogleReply() {
        let json = Data("""
        {"candidates":[{"content":{"parts":[{"text":"Hey"}]}}]}
        """.utf8)
        let reply = AIRequestBuilder.parseAssistantReply(from: json, provider: .google)
        XCTAssertEqual(reply, "Hey")
    }

    func testParseUnrecognizedReplyFallback() {
        let json = Data("{}".utf8)
        let reply = AIRequestBuilder.parseAssistantReply(from: json, provider: .anthropic)
        XCTAssertEqual(reply, "(Empty response)")
    }

    func testParseErrorMessageFromNestedError() {
        let body = """
        {"error":{"message":"bad key"}}
        """
        XCTAssertEqual(AIRequestBuilder.parseErrorMessage(from: body, statusCode: 401), "bad key")
    }

    func testParseErrorMessageFromTopLevel() {
        let body = """
        {"message":"rate limited"}
        """
        XCTAssertEqual(AIRequestBuilder.parseErrorMessage(from: body, statusCode: 429), "rate limited")
    }

    func testParseErrorMessageFallbackToStatus() {
        XCTAssertEqual(AIRequestBuilder.parseErrorMessage(from: "not json", statusCode: 500), "HTTP 500")
    }
}

import Testing
import Foundation
@testable import AIPluginKit

@Suite("AIPluginKit")
struct AIPluginKitTests {

    @Test("AIRequestSpec.http applies sensible defaults")
    func requestSpecDefaults() throws {
        let url = try #require(URL(string: "https://example.com/v1"))
        let spec = AIRequestSpec.http(url: url)
        #expect(spec.timeout == 120)
        guard case let .http(method, specURL, headers, body) = spec.transport else {
            Issue.record("expected an http transport")
            return
        }
        #expect(method == .post)
        #expect(specURL == url)
        #expect(headers.isEmpty)
        #expect(body == nil)
    }

    @Test("AIRequestSpec.command carries the subprocess description")
    func commandSpec() {
        let exe = URL(fileURLWithPath: "/usr/bin/env")
        let spec = AIRequestSpec.command(executableURL: exe, arguments: ["echo", "hi"], stdin: Data("in".utf8))
        guard case let .command(executableURL, arguments, stdin, environment) = spec.transport else {
            Issue.record("expected a command transport")
            return
        }
        #expect(executableURL == exe)
        #expect(arguments == ["echo", "hi"])
        #expect(stdin == Data("in".utf8))
        #expect(environment.isEmpty)
    }

    @Test("AIPluginConfig exposes conventional accessors")
    func configAccessors() {
        let config = AIPluginConfig(["apiKey": "k", "baseURL": "https://h", "model": "m", "extra": "x"])
        #expect(config.apiKey == "k")
        #expect(config.baseURL == "https://h")
        #expect(config.model == "m")
        #expect(config["extra"] == "x")
        #expect(config["missing"] == nil)
    }

    @Test("a plugin builds an http request from its context")
    func pluginBuildsRequest() throws {
        let plugin = EchoPlugin()
        let expected = try #require(URL(string: "https://api.example.com/chat"))
        let context = AIChatContext(
            messages: [AIChatMessage(role: .user, content: "hi")],
            model: "test-model",
            config: AIPluginConfig(["apiKey": "secret"])
        )
        let spec = try plugin.buildRequest(context)
        guard case let .http(method, url, headers, body) = spec.transport else {
            Issue.record("expected an http transport")
            return
        }
        #expect(url == expected)
        #expect(headers["x-api-key"] == "secret")
        #expect(method == .post)
        #expect(body == Data("test-model".utf8))
    }

    @Test("a decoder buffers partial frames across consume calls")
    func decoderBuffersPartialFrames() {
        let decoder = EchoPlugin().makeDecoder()
        var events: [AIStreamEvent] = []
        events += decoder.consume(Data("he".utf8))
        events += decoder.consume(Data("llo\nwor".utf8))
        events += decoder.consume(Data("ld\n".utf8))
        events += decoder.finish()

        let texts = events.compactMap { event -> String? in
            if case let .textDelta(text) = event { return text }
            return nil
        }
        #expect(texts == ["hello", "world"])
    }
}

/// A trivial in-test plugin: posts to a fixed URL with the API key as a header
/// and the model name as the body, and decodes a newline-delimited byte stream
/// into one text event per line.
private final class EchoPlugin: AIPlugin {

    init() {}

    func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
        guard let url = URL(string: "https://api.example.com/chat") else {
            throw EchoError.badURL
        }
        var headers: [String: String] = [:]
        if let key = context.config.apiKey {
            headers["x-api-key"] = key
        }
        return .http(url: url, headers: headers, body: Data(context.model.utf8))
    }

    func makeDecoder() -> any AIStreamDecoder {
        LineDecoder()
    }

    enum EchoError: Error {
        case badURL
    }
}

/// Emits one `.textDelta` per complete newline-terminated line, buffering any
/// trailing partial line until more bytes arrive.
private final class LineDecoder: AIStreamDecoder {
    private var buffer = Data()

    func consume(_ data: Data) -> [AIStreamEvent] {
        buffer.append(data)
        var events: [AIStreamEvent] = []
        let newline = UInt8(ascii: "\n")
        while let index = buffer.firstIndex(of: newline) {
            let lineData = buffer.subdata(in: buffer.startIndex..<index)
            buffer.removeSubrange(buffer.startIndex...index)
            if let line = String(data: lineData, encoding: .utf8) {
                events.append(.textDelta(line))
            }
        }
        return events
    }
}

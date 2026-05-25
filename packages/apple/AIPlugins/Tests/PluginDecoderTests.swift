import Foundation
import Testing
import AIPluginKit

/// Tests each plugin's stream decoder: how it turns provider bytes into
/// `AIStreamEvent`s. Covers the two distinct shapes — Anthropic's incremental
/// SSE stream (with partial frames split across reads) and the buffered
/// whole-response JSON decoders shared by the OpenAI/Google/compatible plugins —
/// plus the plain-text passthrough used by the local CLI plugin.
@Suite("AI plugin stream decoding")
struct PluginDecoderTests {

    private func textDeltas(_ events: [AIStreamEvent]) -> String {
        events.reduce(into: "") { result, event in
            if case let .textDelta(text) = event { result += text }
        }
    }

    private func containsEnd(_ events: [AIStreamEvent]) -> Bool {
        events.contains { event in
            if case .end = event { return true }
            return false
        }
    }

    @Test("ClaudeSSEDecoder assembles a content delta split across two reads")
    func claudeSSEDecoderBuffersFrames() {
        let decoder = ClaudeSSEDecoder()
        let frameStart = "data: {\"type\":\"content_block_delta\",\"delta\":{\"text\":\"Hel"
        // First read stops mid-frame (no newline yet): nothing decodable.
        #expect(decoder.consume(Data(frameStart.utf8)).isEmpty)
        // Second read completes the line and yields the buffered text.
        let events = decoder.consume(Data("lo\"}}\n".utf8))
        #expect(textDeltas(events) == "Hello")
    }

    @Test("ClaudeSSEDecoder ends the stream on message_stop and on [DONE]")
    func claudeSSEDecoderEnds() {
        #expect(containsEnd(ClaudeSSEDecoder().consume(Data("data: {\"type\":\"message_stop\"}\n".utf8))))
        #expect(containsEnd(ClaudeSSEDecoder().consume(Data("data: [DONE]\n".utf8))))
    }

    @Test("OpenAIReplyDecoder buffers the JSON body and emits content on finish")
    func openAIReplyDecoder() {
        let body = "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"Hi there\"}}]}"
        let split = body.index(body.startIndex, offsetBy: 25)
        let decoder = OpenAIReplyDecoder()
        // Buffered decoders emit nothing until the stream closes.
        #expect(decoder.consume(Data(body[..<split].utf8)).isEmpty)
        #expect(decoder.consume(Data(body[split...].utf8)).isEmpty)
        let final = decoder.finish()
        #expect(textDeltas(final) == "Hi there")
        #expect(containsEnd(final))
    }

    @Test("GeminiReplyDecoder extracts the candidate text on finish")
    func geminiReplyDecoder() {
        let body = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Hey\"}]}}]}"
        let decoder = GeminiReplyDecoder()
        #expect(decoder.consume(Data(body.utf8)).isEmpty)
        let final = decoder.finish()
        #expect(textDeltas(final) == "Hey")
        #expect(containsEnd(final))
    }

    @Test("PlainTextDecoder passes stdout chunks through and ignores empty chunks")
    func plainTextDecoder() {
        let decoder = PlainTextDecoder()
        #expect(textDeltas(decoder.consume(Data("partial answer".utf8))) == "partial answer")
        #expect(decoder.consume(Data()).isEmpty)
        #expect(containsEnd(decoder.finish()))
    }
}

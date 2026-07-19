import Testing
import Foundation
@testable import AIPluginKit

/// `AIRequestSpec.timeout` is documented as a WALL-CLOCK budget for the whole
/// request. These tests drive the real command transport with a local `/bin/sh`
/// child — hermetic, no network — because an idle-based timeout can never catch a
/// trickling stream that keeps sending bytes.
@Suite("PluginTransport")
struct PluginTransportTests {

    /// Minimal passthrough plugin: each newline-terminated frame becomes one
    /// `textDelta` event.
    private final class LinePlugin: AIPlugin {
        func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
            fatalError("unused: specs are built directly in the tests")
        }
        func makeDecoder() -> any AIStreamDecoder { LineDecoder() }
    }

    private final class LineDecoder: AIStreamDecoder {
        func consume(_ data: Data) -> [AIStreamEvent] {
            guard let text = String(bytes: data, encoding: .utf8), !text.isEmpty else { return [] }
            return [.textDelta(text)]
        }
    }

    @Test("spec.timeout cuts off a trickling command by wall clock")
    func wallClockBudgetCutsTricklingCommand() async throws {
        // Emits a line every 50 ms forever: every byte would reset an idle
        // timeout, so only a wall-clock bound can end this stream.
        let spec = AIRequestSpec.command(
            executableURL: URL(fileURLWithPath: "/bin/sh"),
            arguments: ["-c", "while :; do echo tick; sleep 0.05; done"],
            timeout: 0.5
        )
        let start = Date()
        var sawText = false
        do {
            for try await event in PluginTransport.run(spec: spec, plugin: LinePlugin()) {
                if case .textDelta = event { sawText = true }
            }
            Issue.record("a never-ending trickle must be cut off at the budget")
        } catch let error as PluginTransport.TransportError {
            guard case .timedOut = error else {
                Issue.record("expected timedOut, got \(error)")
                return
            }
        }
        #expect(sawText, "bytes were flowing before the cut-off")
        #expect(Date().timeIntervalSince(start) < 5, "the cut-off is the budget, not an idle timeout")
    }

    @Test("a command that finishes within the budget streams to completion")
    func commandWithinBudgetStreamsToCompletion() async throws {
        let spec = AIRequestSpec.command(
            executableURL: URL(fileURLWithPath: "/bin/sh"),
            arguments: ["-c", "printf 'hello\\n'"],
            timeout: 10
        )
        var reply = ""
        for try await event in PluginTransport.run(spec: spec, plugin: LinePlugin()) {
            if case .textDelta(let text) = event { reply += text }
        }
        #expect(reply.contains("hello"))
    }
}

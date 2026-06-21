// Tests/AgenticToolkitMacOSTests/Chat/LocalChatSessionTests.swift
import Testing
import Foundation
import AIPluginKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

/// Collects ChatEvents in isolation-safe storage for async tests.
private actor EventCollector {
    private(set) var deltas: [String] = []
    private(set) var finished = false
    func appendDelta(_ text: String) { deltas.append(text) }
    func setFinished() { finished = true }
}

@Suite("LocalChatSession")
struct LocalChatSessionTests {

    @Test("streams deltas from the injected transport and finishes")
    func streamsAndFinishes() async {
        // Fake transport: yields two text deltas then end, ignoring spec/plugin.
        let factory: LocalChatSession.EventStreamFactory = { _, _ in
            AsyncThrowingStream { continuation in
                continuation.yield(.textDelta("Hel"))
                continuation.yield(.textDelta("lo"))
                continuation.yield(.end(stopReason: "end_turn"))
                continuation.finish()
            }
        }
        let session = LocalChatSession(
            resolvePlugin: { StubPlugin() },
            makeContext: { _ in
                AIChatContext(messages: [], model: "m", systemPrompt: nil, tools: [], config: AIPluginConfig([:]))
            },
            eventStreamFactory: factory,
            toolSource: nil
        )

        let collector = EventCollector()

        let collectorTask = Task {
            for await event in session.events() {
                if case .responseDelta(_, let text) = event { await collector.appendDelta(text) }
                if case .responseFinished = event { await collector.setFinished(); break }
            }
        }
        try? await Task.sleep(for: .milliseconds(20))
        session.send("hi")
        await collectorTask.value
        session.close()

        let deltas = await collector.deltas
        let finished = await collector.finished

        #expect(deltas.joined() == "Hello")
        #expect(finished)
    }
}

/// Minimal plugin stub — never actually invoked by the fake factory.
private final class StubPlugin: AIPlugin, @unchecked Sendable {
    init() {}
    func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
        .command(executableURL: URL(fileURLWithPath: "/bin/echo"), arguments: [], stdin: nil, environment: [:])
    }
    func makeDecoder() -> any AIStreamDecoder { PassthroughDecoder() }
}

private final class PassthroughDecoder: AIStreamDecoder {
    func consume(_ data: Data) -> [AIStreamEvent] { [] }
}

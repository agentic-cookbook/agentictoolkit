// Tests/AgenticToolkitCoreTests/Chat/MockChatSessionTests.swift
import Testing
import Foundation
@testable import AgenticToolkitCore

/// Collects ChatEvents in isolation-safe storage for async tests.
private actor EventCollector {
    private(set) var events: [ChatEvent] = []
    func append(_ event: ChatEvent) { events.append(event) }
}

@Suite("MockChatSession")
struct MockChatSessionTests {

    @Test("emits ready on subscribe, then echoes a user turn and streams a reply")
    func streamsScriptedReply() async {
        let session = MockChatSession(reply: "Hi there", chunkSize: 3)
        let collector = EventCollector()

        let collectorTask = Task {
            for await event in session.events() {
                await collector.append(event)
                if case .responseFinished = event { break }
            }
        }
        // give the subscription a tick to seed .ready
        try? await Task.sleep(for: .milliseconds(20))
        session.send("hello")
        await collectorTask.value
        session.close()

        let received = await collector.events

        #expect(received.first == .stateChanged(.ready))
        #expect(received.contains {
            if case .userMessage(let msg) = $0 { return msg.text == "hello" } else { return false }
        })
        let deltas = received.compactMap { event -> String? in
            if case .responseDelta(_, let txt) = event { return txt } else { return nil }
        }
        #expect(deltas.joined() == "Hi there")
        #expect(received.contains { if case .responseStarted = $0 { return true } else { return false } })
        #expect(received.last.map { if case .responseFinished = $0 { return true } else { return false } } == true)
    }
}

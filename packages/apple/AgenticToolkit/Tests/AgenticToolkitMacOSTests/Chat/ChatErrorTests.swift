// Tests/AgenticToolkitMacOSTests/Chat/ChatErrorTests.swift
import Testing
import Foundation
import AIPluginKit
@testable import AgenticToolkitCore

@Suite("ChatError")
struct ChatErrorTests {

    @Test("surfaces the transport error detail")
    func surfacesTransportDetail() {
        let error = PluginTransport.TransportError.http(status: 404, message: "model 'llama3.2' not found")
        #expect(ChatError(from: error, isRetryable: true).message
                == "Request failed: model 'llama3.2' not found")
    }

    @Test("falls back when the error has no description")
    func fallsBackWithoutDetail() {
        struct Blank: Error {}
        #expect(ChatError(from: Blank(), isRetryable: true).message.hasPrefix("Request failed"))
    }
}

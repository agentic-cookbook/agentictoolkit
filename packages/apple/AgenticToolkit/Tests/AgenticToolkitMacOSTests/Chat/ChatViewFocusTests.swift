// Tests/AgenticToolkitMacOSTests/Chat/ChatViewFocusTests.swift
import AppKit
import XCTest
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@MainActor
final class ChatViewFocusTests: XCTestCase {
    private var window: NSWindow?

    override func tearDown() async throws {
        window?.orderOut(nil)
        window = nil
        try await super.tearDown()
    }

    func testFocusInputOutsideAWindowReturnsFalse() {
        let viewModel = AIChatViewModel(session: MockChatSession())
        let view = ChatView(viewModel: viewModel)

        XCTAssertNil(view.window)
        XCTAssertFalse(view.focusInput())
    }

    func testFocusInputMakesTheFieldEditorFirstResponder() {
        let viewModel = AIChatViewModel(session: MockChatSession())
        let view = ChatView(viewModel: viewModel)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 400, height: 300),
            styleMask: [.titled],
            backing: .buffered,
            defer: false
        )
        window.contentView = view
        self.window = window

        XCTAssertTrue(view.focusInput())
        XCTAssertTrue(window.firstResponder is NSTextView)
        XCTAssertEqual((window.firstResponder as? NSTextView)?.isFieldEditor, true)
    }
}

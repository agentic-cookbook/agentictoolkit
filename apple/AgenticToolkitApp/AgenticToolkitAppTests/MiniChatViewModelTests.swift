import XCTest
import AgenticToolkitPluginSDK
import AgenticToolkitPluginSDK
@testable import AgenticToolkitApp

final class ChatViewModelIntegrationTests: XCTestCase {

    private var databaseManager: DatabaseManager!
    private var tempDBPath: String!

    override func setUpWithError() throws {
        try super.setUpWithError()
        let tempDir = NSTemporaryDirectory()
        tempDBPath = (tempDir as NSString).appendingPathComponent("agentic_chat_test_\(UUID().uuidString).db")
        databaseManager = try DatabaseManager(path: tempDBPath)
    }

    override func tearDownWithError() throws {
        databaseManager.close()
        try? FileManager.default.removeItem(atPath: tempDBPath)
        try super.tearDownWithError()
    }

    private func makeViewModel() -> ChatViewModel {
        let pm = PluginManager(searchPaths: [])
        let persistence = DatabaseManagerPersistence(databaseManager: databaseManager)
        let aiSettings = AISettingsViewModel(pluginManager: pm, persistence: persistence)
        return ChatViewModel(pluginManager: pm, configProvider: aiSettings)
    }

    // MARK: - sendMessage

    func testSendMessageAddsUserMessage() {
        let vm = makeViewModel()
        XCTAssertTrue(vm.messages.isEmpty)

        vm.sendMessage("hello world")

        XCTAssertGreaterThanOrEqual(vm.messages.count, 1)
        XCTAssertEqual(vm.messages[0].role, .user)
        XCTAssertEqual(vm.messages[0].text, "hello world")
    }

    func testSendMessageTrimsWhitespace() {
        let vm = makeViewModel()
        vm.sendMessage("  hello  ")

        XCTAssertGreaterThanOrEqual(vm.messages.count, 1)
        XCTAssertEqual(vm.messages[0].text, "hello")
    }

    func testSendEmptyMessageDoesNothing() {
        let vm = makeViewModel()
        vm.sendMessage("")
        XCTAssertTrue(vm.messages.isEmpty)

        vm.sendMessage("   ")
        XCTAssertTrue(vm.messages.isEmpty)

        vm.sendMessage("\n\t")
        XCTAssertTrue(vm.messages.isEmpty)
    }

    func testMultipleMessagesQueue() {
        let vm = makeViewModel()
        vm.sendMessage("first")
        vm.sendMessage("second")
        vm.sendMessage("third")

        let userMessages = vm.messages.filter { $0.role == .user }
        XCTAssertEqual(userMessages.count, 3)
        XCTAssertEqual(userMessages[0].text, "first")
        XCTAssertEqual(userMessages[1].text, "second")
        XCTAssertEqual(userMessages[2].text, "third")
    }

    // MARK: - clearHistory

    func testClearHistory() {
        let vm = makeViewModel()
        vm.sendMessage("one")
        vm.sendMessage("two")
        XCTAssertFalse(vm.messages.isEmpty)

        vm.clearHistory()

        XCTAssertTrue(vm.messages.isEmpty)
        XCTAssertFalse(vm.isTyping)
    }

    // MARK: - Message properties

    func testMessageHasTimestamp() {
        let vm = makeViewModel()
        let before = Date()
        vm.sendMessage("timestamped")
        let after = Date()

        let msg = vm.messages[0]
        XCTAssertGreaterThanOrEqual(msg.timestamp, before)
        XCTAssertLessThanOrEqual(msg.timestamp, after)
    }

    func testMessageHasUniqueID() {
        let vm = makeViewModel()
        vm.sendMessage("a")
        vm.sendMessage("b")

        let userMessages = vm.messages.filter { $0.role == .user }
        XCTAssertEqual(userMessages.count, 2)
        XCTAssertNotEqual(userMessages[0].id, userMessages[1].id)
    }

    // MARK: - ChatView integration

    func testChatViewDoesNotCrashOnSendMessage() {
        let vm = makeViewModel()
        let chatView = ChatView(viewModel: vm)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 400, height: 500),
            styleMask: [.titled],
            backing: .buffered,
            defer: false
        )
        chatView.translatesAutoresizingMaskIntoConstraints = false
        window.contentView?.addSubview(chatView)
        NSLayoutConstraint.activate([
            chatView.topAnchor.constraint(equalTo: window.contentView!.topAnchor),
            chatView.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor),
            chatView.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor),
            chatView.bottomAnchor.constraint(equalTo: window.contentView!.bottomAnchor),
        ])
        window.layoutIfNeeded()

        vm.sendMessage("test message")

        let expectation = XCTestExpectation(description: "Rebuild completes")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2.0)

        XCTAssertGreaterThanOrEqual(vm.messages.count, 1)
    }

    // MARK: - Queue error handling

    func testQueueProducesErrorWhenNoBackend() {
        let vm = makeViewModel()
        vm.sendMessage("test")

        let expectation = XCTestExpectation(description: "Queue processes")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 3.0)

        XCTAssertGreaterThanOrEqual(vm.messages.count, 1)
        XCTAssertFalse(vm.isTyping)
    }
}

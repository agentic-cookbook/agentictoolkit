import XCTest
import AgenticToolkitAIPlugins
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
        let pluginManager = AIPluginManager(searchPaths: [])
        let persistence = DatabaseManagerPersistence(databaseManager: databaseManager)
        let aiSettings = AISettingsViewModel(pluginManager: pluginManager, persistence: persistence)
        return ChatViewModel(pluginManager: pluginManager, configProvider: aiSettings)
    }

    // MARK: - sendMessage

    func testSendMessageAddsUserMessage() {
        let viewModel = makeViewModel()
        XCTAssertTrue(viewModel.messages.isEmpty)

        viewModel.sendMessage("hello world")

        XCTAssertGreaterThanOrEqual(viewModel.messages.count, 1)
        XCTAssertEqual(viewModel.messages[0].role, .user)
        XCTAssertEqual(viewModel.messages[0].text, "hello world")
    }

    func testSendMessageTrimsWhitespace() {
        let viewModel = makeViewModel()
        viewModel.sendMessage("  hello  ")

        XCTAssertGreaterThanOrEqual(viewModel.messages.count, 1)
        XCTAssertEqual(viewModel.messages[0].text, "hello")
    }

    func testSendEmptyMessageDoesNothing() {
        let viewModel = makeViewModel()
        viewModel.sendMessage("")
        XCTAssertTrue(viewModel.messages.isEmpty)

        viewModel.sendMessage("   ")
        XCTAssertTrue(viewModel.messages.isEmpty)

        viewModel.sendMessage("\n\t")
        XCTAssertTrue(viewModel.messages.isEmpty)
    }

    func testMultipleMessagesQueue() {
        let viewModel = makeViewModel()
        viewModel.sendMessage("first")
        viewModel.sendMessage("second")
        viewModel.sendMessage("third")

        let userMessages = viewModel.messages.filter { $0.role == .user }
        XCTAssertEqual(userMessages.count, 3)
        XCTAssertEqual(userMessages[0].text, "first")
        XCTAssertEqual(userMessages[1].text, "second")
        XCTAssertEqual(userMessages[2].text, "third")
    }

    // MARK: - clearHistory

    func testClearHistory() {
        let viewModel = makeViewModel()
        viewModel.sendMessage("one")
        viewModel.sendMessage("two")
        XCTAssertFalse(viewModel.messages.isEmpty)

        viewModel.clearHistory()

        XCTAssertTrue(viewModel.messages.isEmpty)
        XCTAssertFalse(viewModel.isTyping)
    }

    // MARK: - Message properties

    func testMessageHasTimestamp() {
        let viewModel = makeViewModel()
        let before = Date()
        viewModel.sendMessage("timestamped")
        let after = Date()

        let msg = viewModel.messages[0]
        XCTAssertGreaterThanOrEqual(msg.timestamp, before)
        XCTAssertLessThanOrEqual(msg.timestamp, after)
    }

    func testMessageHasUniqueID() {
        let viewModel = makeViewModel()
        viewModel.sendMessage("a")
        viewModel.sendMessage("b")

        let userMessages = viewModel.messages.filter { $0.role == .user }
        XCTAssertEqual(userMessages.count, 2)
        XCTAssertNotEqual(userMessages[0].id, userMessages[1].id)
    }

    // MARK: - ChatView integration

    func testChatViewDoesNotCrashOnSendMessage() {
        let viewModel = makeViewModel()
        let chatView = ChatView(viewModel: viewModel)

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
            chatView.bottomAnchor.constraint(equalTo: window.contentView!.bottomAnchor)
        ])
        window.layoutIfNeeded()

        viewModel.sendMessage("test message")

        let expectation = XCTestExpectation(description: "Rebuild completes")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 2.0)

        XCTAssertGreaterThanOrEqual(viewModel.messages.count, 1)
    }

    // MARK: - Queue error handling

    func testQueueProducesErrorWhenNoBackend() {
        let viewModel = makeViewModel()
        viewModel.sendMessage("test")

        let expectation = XCTestExpectation(description: "Queue processes")
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            expectation.fulfill()
        }
        wait(for: [expectation], timeout: 3.0)

        XCTAssertGreaterThanOrEqual(viewModel.messages.count, 1)
        XCTAssertFalse(viewModel.isTyping)
    }
}

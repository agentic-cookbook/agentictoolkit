import Testing
import AppKit
import Foundation
@testable import AgenticToolkitMacOS

/// `MainActorScriptCommand` is normally instantiated by Cocoa Scripting in
/// response to an AppleEvent. For unit testing we bypass that machinery and
/// call `performDefaultImplementation()` directly on a hand-constructed
/// instance — the override under test only exercises the `performMain()`
/// dispatch path, not any AppleEvent state on the superclass.
@Suite("MainActorScriptCommand")
@MainActor
struct MainActorScriptCommandTests {

    /// Minimal `NSScriptCommandDescription` for instantiating subclasses of
    /// `NSScriptCommand` without going through the real scripting registry.
    /// AppleEvent four-char codes must be valid OSType values; the specific
    /// codes don't matter since nothing dispatches this via AppleEvents.
    private func makeDescription() -> NSScriptCommandDescription {
        NSScriptCommandDescription(
            suiteName: "AgenticTestSuite",
            commandName: "test",
            dictionary: [
                "CommandClass": "NSScriptCommand",
                "AppleEventCode": "tstC",
                "AppleEventClassCode": "tstS"
            ]
        )!
    }

    @Test("base class performMain returns nil")
    func baseReturnsNil() {
        let cmd = MainActorScriptCommand(commandDescription: makeDescription())
        #expect(cmd.performDefaultImplementation() == nil)
    }

    @Test("subclass performMain result is returned by performDefaultImplementation")
    func subclassReturnValue() {
        let cmd = ReturningCommand(description: makeDescription(), value: "answer")
        #expect(cmd.performDefaultImplementation() as? String == "answer")
    }

    @Test("subclass can return non-string values")
    func subclassReturnsInt() {
        let cmd = ReturningCommand(description: makeDescription(), value: 42)
        #expect(cmd.performDefaultImplementation() as? Int == 42)
    }

    @Test("subclass returning nil is preserved through the dispatch")
    func subclassReturnsNil() {
        let cmd = ReturningCommand(description: makeDescription(), value: nil)
        #expect(cmd.performDefaultImplementation() == nil)
    }

    @Test("performMain is invoked on the main thread")
    func runsOnMainThread() {
        let cmd = MainActorAssertingCommand(commandDescription: makeDescription())
        _ = cmd.performDefaultImplementation()
        #expect(cmd.sawMainThread)
    }
}

// MARK: - Fixtures

/// Echoes a caller-supplied value back from `performMain`.
private final class ReturningCommand: MainActorScriptCommand, @unchecked Sendable {
    let value: Any?

    init(description: NSScriptCommandDescription, value: Any?) {
        self.value = value
        super.init(commandDescription: description)
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override func performMain() -> Any? { value }
}

/// Records whether `performMain` saw the main thread at invocation time.
private final class MainActorAssertingCommand: MainActorScriptCommand, @unchecked Sendable {
    nonisolated(unsafe) var sawMainThread = false

    override func performMain() -> Any? {
        sawMainThread = Thread.isMainThread
        return nil
    }
}

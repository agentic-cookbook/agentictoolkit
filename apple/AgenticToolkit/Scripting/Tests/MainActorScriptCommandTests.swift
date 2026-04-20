import XCTest
@testable import Scripting

@MainActor
final class MainActorScriptCommandTests: XCTestCase {

    private final class RecordingCommand: MainActorScriptCommand {
        static nonisolated(unsafe) var invocationCount = 0
        static nonisolated(unsafe) var returnValue: Any? = "ok"

        override func performMain() -> Any? {
            Self.invocationCount += 1
            return Self.returnValue
        }
    }

    override func setUp() {
        super.setUp()
        RecordingCommand.invocationCount = 0
        RecordingCommand.returnValue = "ok"
    }

    func testPerformDefaultImplementationDispatchesToPerformMain() {
        let cmd = RecordingCommand()
        let result = cmd.performDefaultImplementation() as? String
        XCTAssertEqual(result, "ok")
        XCTAssertEqual(RecordingCommand.invocationCount, 1)
    }

    func testSubclassCanReturnArbitraryAny() {
        RecordingCommand.returnValue = [1, 2, 3]
        let cmd = RecordingCommand()
        XCTAssertEqual(cmd.performDefaultImplementation() as? [Int], [1, 2, 3])
    }

    func testBaseClassPerformMainReturnsNil() {
        // Default implementation of `performMain()` in the base class is nil.
        let cmd = MainActorScriptCommand()
        XCTAssertNil(cmd.performDefaultImplementation())
    }
}

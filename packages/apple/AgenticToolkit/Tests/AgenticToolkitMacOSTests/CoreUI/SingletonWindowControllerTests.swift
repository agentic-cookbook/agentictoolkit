import AppKit
import XCTest
@testable import AgenticToolkitMacOS

@MainActor
final class SingletonWindowControllerTests: XCTestCase {
    private final class FakeVC: NSViewController {
        override func loadView() { view = NSView(frame: NSRect(x: 0, y: 0, width: 200, height: 120)) }
    }

    private final class Probe: SingleWindowController, SingletonWindowController {
        static var current: Probe?
        static var made = 0
        static func makeShared() -> Probe {
            made += 1
            // A UUID suffix -- not `made`, which `tearDown` resets to 0 after
            // every method -- keeps each constructed `Probe` on its own
            // window id even across test-method boundaries, so no method can
            // observe (or accidentally depend on) state a previous method's
            // id left behind in `WindowManager.shared`.
            return Probe(windowID: "singleton-probe-\(UUID().uuidString)", contentViewController: FakeVC())
        }
    }

    override func tearDown() async throws {
        if let id = Probe.current?.windowID {
            WindowManager.shared.frames.clearSavedState(for: id)
            WindowManager.shared.frames.clearVisibility(for: id)
        }
        Probe.current?.window?.orderOut(nil)
        Probe.current = nil
        Probe.made = 0
        try await super.tearDown()
    }

    func testIsOpenIsFalseBeforeAnythingExists() {
        XCTAssertFalse(Probe.isOpen())
        XCTAssertNil(Probe.current, "asking is not making")
    }

    func testPresentMakesTheSharedControllerOnceAndShowsItsWindow() {
        Probe.present()
        XCTAssertEqual(Probe.made, 1)
        let window = Probe.current?.window
        XCTAssertNotNil(window)
        XCTAssertTrue(window?.isVisible ?? false)
        XCTAssertTrue(Probe.isOpen())
        Probe.present()
        XCTAssertEqual(Probe.made, 1, "a second present() reuses the shared controller")
    }

    func testIsOpenFollowsTheWindowNotTheController() {
        Probe.present()
        Probe.current?.window?.orderOut(nil)
        XCTAssertNotNil(Probe.current)
        XCTAssertFalse(Probe.isOpen())
    }

    /// Regression for the id half of Finding 34: pre-fix, `makeShared()`
    /// baked `made` straight into the window id, and `tearDown` reset `made`
    /// to 0 -- so the first `Probe` any method built always got the exact
    /// same id as the first `Probe` every other method built,
    /// `"singleton-probe-1"`. Calling `tearDown()` directly mid-test
    /// simulates the framework's between-method reset deterministically
    /// (rather than relying on two real test methods, whose relative
    /// execution order XCTest does not guarantee), and proves the id
    /// `makeShared()` hands out no longer depends on that reset.
    func testWindowIDsDoNotRepeatAcrossSimulatedTestMethodBoundaries() async throws {
        Probe.present()
        let firstID = Probe.current?.windowID
        try await tearDown()

        Probe.present()
        let secondID = Probe.current?.windowID

        XCTAssertNotNil(firstID)
        XCTAssertNotNil(secondID)
        XCTAssertNotEqual(firstID, secondID, "a window id must not repeat across test-method boundaries")
    }
}

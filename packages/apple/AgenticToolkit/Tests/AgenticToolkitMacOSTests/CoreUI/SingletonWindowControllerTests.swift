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
            return Probe(windowID: "singleton-probe-\(made)", contentViewController: FakeVC())
        }
    }

    override func tearDown() async throws {
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
}

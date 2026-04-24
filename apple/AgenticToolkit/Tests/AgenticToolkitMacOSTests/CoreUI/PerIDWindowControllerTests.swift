import AppKit
import XCTest
@testable import AgenticToolkitMacOS

@MainActor
final class PerIDWindowControllerTests: XCTestCase {

    private final class StringIDWC: PerIDWindowController<String> {
        override var windowTitle: String { "string-\(id)" }
        override func makeContentViewController() -> NSViewController? {
            let vc = NSViewController()
            vc.view = NSView(frame: NSRect(x: 0, y: 0, width: 200, height: 200))
            return vc
        }
    }

    private final class Int64IDWC: PerIDWindowController<Int64> {
        override var windowTitle: String { "int-\(id)" }
        override func makeContentViewController() -> NSViewController? {
            let vc = NSViewController()
            vc.view = NSView(frame: NSRect(x: 0, y: 0, width: 200, height: 200))
            return vc
        }
    }

    // MARK: - Tests

    func testPresentReturnsExistingControllerForSameID() {
        let first = StringIDWC.present(id: "alpha") {
            StringIDWC(id: "alpha", windowID: "t1.\("alpha")")
        }
        let second = StringIDWC.present(id: "alpha") {
            XCTFail("factory must not be called when a controller for this ID already exists")
            return StringIDWC(id: "alpha", windowID: "t1.alpha.unused")
        }
        XCTAssertTrue(first === second)

        // cleanup
        first.windowWillClose(Notification(name: NSWindow.willCloseNotification))
    }

    func testDifferentIDsHaveDistinctControllers() {
        let a = StringIDWC.present(id: "a") {
            StringIDWC(id: "a", windowID: "t2.a")
        }
        let b = StringIDWC.present(id: "b") {
            StringIDWC(id: "b", windowID: "t2.b")
        }
        XCTAssertFalse(a === b)
        XCTAssertEqual(StringIDWC.controller(for: "a"), a)
        XCTAssertEqual(StringIDWC.controller(for: "b"), b)

        a.windowWillClose(Notification(name: NSWindow.willCloseNotification))
        b.windowWillClose(Notification(name: NSWindow.willCloseNotification))
    }

    func testWindowWillCloseClearsRegistry() {
        let wc = StringIDWC.present(id: "closeme") {
            StringIDWC(id: "closeme", windowID: "t3.closeme")
        }
        XCTAssertNotNil(StringIDWC.controller(for: "closeme"))
        wc.windowWillClose(Notification(name: NSWindow.willCloseNotification))
        XCTAssertNil(StringIDWC.controller(for: "closeme"))
    }

    func testSubclassesHaveIsolatedIDSpaces() {
        let str = StringIDWC.present(id: "42") {
            StringIDWC(id: "42", windowID: "t4.str.42")
        }
        let int = Int64IDWC.present(id: 42) {
            Int64IDWC(id: 42, windowID: "t4.int.42")
        }
        XCTAssertFalse((str as AnyObject) === (int as AnyObject))
        XCTAssertNotNil(StringIDWC.controller(for: "42"))
        XCTAssertNotNil(Int64IDWC.controller(for: 42))

        str.windowWillClose(Notification(name: NSWindow.willCloseNotification))
        int.windowWillClose(Notification(name: NSWindow.willCloseNotification))
    }
}

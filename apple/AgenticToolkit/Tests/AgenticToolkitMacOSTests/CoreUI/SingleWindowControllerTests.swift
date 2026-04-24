import AppKit
import XCTest
@testable import AgenticToolkitMacOS

@MainActor
final class SingleWindowControllerTests: XCTestCase {

    // MARK: - Subclasses under test

    private final class ViewControllerBasedWC: SingleWindowController {
        let vc = FakeVC()

        override var windowTitle: String { "VC-Based" }
        override var defaultContentRect: NSRect { NSRect(x: 0, y: 0, width: 321, height: 234) }
        override var windowStyleMask: NSWindow.StyleMask {
            [.titled, .closable, .miniaturizable, .resizable]
        }
        override var minSize: NSSize? { NSSize(width: 100, height: 100) }
        override func makeContentViewController() -> NSViewController? { vc }
    }

    private final class ViewBasedWC: SingleWindowController {
        let customView = NSView(frame: NSRect(x: 0, y: 0, width: 10, height: 10))
        override var windowTitle: String { "View-Based" }
        override func makeContentView() -> NSView? { customView }
    }

    private final class FakeVC: NSViewController {
        private(set) var loadViewCallCount = 0
        override func loadView() {
            loadViewCallCount += 1
            view = NSView(frame: NSRect(x: 0, y: 0, width: 100, height: 100))
        }
    }

    // MARK: - Tests

    func testSubclassOverridesDriveWindowConfig() throws {
        let wc = ViewControllerBasedWC(windowID: "test.vc")
        wc.showWindow()

        let window = try XCTUnwrap(wc.window)
        XCTAssertEqual(window.title, "VC-Based")
        XCTAssertEqual(window.contentViewController, wc.vc)
        XCTAssertTrue(window.styleMask.contains(.miniaturizable))
        XCTAssertEqual(window.minSize, NSSize(width: 100, height: 100))
    }

    func testContentViewControllerLifecycleWiresUp() {
        let wc = ViewControllerBasedWC(windowID: "test.vc.lifecycle")
        wc.showWindow()
        XCTAssertGreaterThan(wc.vc.loadViewCallCount, 0,
            "loadView should fire when contentViewController is set")
    }

    func testViewBasedSubclassInstallsContentView() {
        let wc = ViewBasedWC(windowID: "test.view")
        wc.showWindow()
        XCTAssertNil(wc.window?.contentViewController,
            "view-based path should NOT set contentViewController")
        XCTAssertTrue(wc.customView.isDescendant(of: wc.window?.contentView ?? NSView()),
            "custom view should be a subview of the window's contentView")
    }

    func testReshowReusesSameWindow() {
        let wc = ViewControllerBasedWC(windowID: "test.reuse")
        wc.showWindow()
        let first = wc.window
        wc.showWindow()
        XCTAssertTrue(first === wc.window, "second showWindow should not create a new NSWindow")
    }

    func testIsVisibleReflectsWindowState() {
        let wc = ViewControllerBasedWC(windowID: "test.visible")
        XCTAssertFalse(wc.isVisible, "no window created yet")
        wc.showWindow()
        XCTAssertTrue(wc.isVisible)
        wc.dismiss()
        XCTAssertFalse(wc.isVisible)
    }

    func testWindowWithNoSavedGeometryIsGeometricallyCenteredOnMainScreen() throws {
        // Regression: `NSWindow.center()` places the window at "upper-center"
        // (one-third from the top), NOT the geometric center. A prior
        // iteration called `newWindow.center()` after `WindowManager.restoreFrame`
        // which overrode the correct proportional centering with AppKit's
        // upper-center. Verify BOTH midX and midY match the visible frame's
        // center — an X-only check passed the buggy version.
        let wc = ViewControllerBasedWC(windowID: "test.center.\(UUID().uuidString)")
        wc.showWindow()

        let window = try XCTUnwrap(wc.window)
        let screen = try XCTUnwrap(window.screen ?? NSScreen.main)
        let visible = screen.visibleFrame

        XCTAssertEqual(window.frame.midX, visible.midX, accuracy: 2.0,
            "window with no saved geometry should be horizontally centered on main screen")
        XCTAssertEqual(window.frame.midY, visible.midY, accuracy: 2.0,
            "window with no saved geometry should be VERTICALLY GEOMETRICALLY centered — not AppKit upper-center")
    }

    func testWindowWithRegisteredCenterSpecIsGeometricallyCentered() throws {
        // The spec'd path — what app code does in practice: register a
        // WindowSpec with `.center` and let WindowManager.restoreFrame do
        // the positioning via FrameCalculator.defaultFrame.
        let id = "test.center.spec.\(UUID().uuidString)"
        WindowManager.shared.register(
            id: id,
            spec: WindowSpec(
                defaultSize: NSSize(width: 800, height: 500),
                minSize: NSSize(width: 200, height: 200),
                defaultPosition: .center,
                persistsFrame: true
            )
        )
        WindowManager.shared.clearSavedState(for: id)

        let wc = ViewControllerBasedWC(windowID: id)
        wc.showWindow()

        let window = try XCTUnwrap(wc.window)
        let screen = try XCTUnwrap(window.screen ?? NSScreen.main)
        let visible = screen.visibleFrame

        XCTAssertEqual(window.frame.midX, visible.midX, accuracy: 2.0)
        XCTAssertEqual(window.frame.midY, visible.midY, accuracy: 2.0)
    }

    func testDelegateIsInstalledAfterRestoreFrameSoConstructionEventsDontClobberSavedState() throws {
        // Regression: setting `contentViewController` posts
        // NSWindowDidResizeNotification synchronously. If the delegate is
        // attached before that, `windowDidResize` calls
        // `WindowManager.saveFrame` with the default-NSWindow pre-restore
        // frame, overwriting any prior saved state. Then `restoreFrame`
        // reads back that just-saved default frame and applies it —
        // producing a window positioned at AppKit's initial cascade, not
        // the spec's geometric center.
        //
        // With the delegate installed last, construction-time resize events
        // never reach `saveFrame`, so `restoreFrame` sees a clean "no saved
        // state" and applies the spec's default center.
        let id = "test.delegate.order.\(UUID().uuidString)"
        WindowManager.shared.register(
            id: id,
            spec: WindowSpec(
                defaultSize: NSSize(width: 800, height: 500),
                minSize: NSSize(width: 200, height: 200),
                defaultPosition: .center,
                persistsFrame: true
            )
        )
        WindowManager.shared.clearSavedState(for: id)

        let wc = ViewControllerBasedWC(windowID: id)
        wc.showWindow()

        let window = try XCTUnwrap(wc.window)
        // After construction the persisted state — if anything was saved —
        // must correspond to the spec's default position, not the pre-
        // restore default NSWindow frame. Read the raw persisted state via
        // the shared storage.
        if let saved = WindowManager.shared.storage.loadState(for: id) {
            XCTAssertEqual(saved.width, 800, accuracy: 2.0,
                "saved width must reflect spec default, not pre-restore NSWindow default")
            XCTAssertEqual(saved.height, 500, accuracy: 2.0,
                "saved height must reflect spec default, not pre-restore NSWindow default")
        }
        // And the live window frame must match the spec — proving the
        // construction-time delegate events didn't clobber the restore.
        XCTAssertEqual(window.frame.width, 800, accuracy: 2.0,
            "window width must come from spec, not pre-restore default")
        XCTAssertEqual(window.frame.height, 500, accuracy: 2.0,
            "window height must come from spec, not pre-restore default")
    }
}

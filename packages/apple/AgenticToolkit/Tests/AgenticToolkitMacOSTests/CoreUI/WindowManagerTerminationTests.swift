import AppKit
import XCTest
@testable import AgenticToolkitMacOS

/// Regression coverage for the "HUD doesn't reopen after quit" bug.
///
/// AppKit sends `windowWillClose:` to still-visible windows while the app is
/// terminating (verified by a runtime probe: the order is
/// `applicationWillTerminate` → `windowWillClose`). The old
/// `SingleWindowController.windowWillClose` persisted `visible = false`
/// unconditionally, so a window the user left open at quit was recorded as
/// hidden and never restored on the next launch. The fix lets `WindowManager`
/// track termination and skip that destructive save.
@MainActor
final class WindowManagerTerminationTests: XCTestCase {

    private final class FakeVC: NSViewController {
        override func loadView() {
            view = NSView(frame: NSRect(x: 0, y: 0, width: 100, height: 100))
        }
    }

    /// A `SingleWindowController` that opts in to visibility persistence
    /// (the `.default` behavior set includes `.persistsVisibility`).
    private final class TestWC: SingleWindowController {
        init(windowID: String) {
            super.init(windowID: windowID, contentViewController: FakeVC())
            self.windowStyleMask = [.titled, .closable, .resizable]
            self.windowSpec = WindowSpec(
                defaultSize: NSSize(width: 300, height: 200),
                minSize: NSSize(width: 100, height: 100),
                defaultPosition: .center
            )
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError() }
    }

    func testWillTerminateNotificationSetsTerminatingFlag() {
        // `WindowManager.shared` is a process-wide singleton; clear the flag
        // on the way out so a terminating-state test can't leak into other
        // suites that rely on close-persisting-hidden.
        defer { WindowManager.shared.isTerminating = false }
        XCTAssertFalse(WindowManager.shared.isTerminating)
        NotificationCenter.default.post(
            name: NSApplication.willTerminateNotification, object: NSApp
        )
        XCTAssertTrue(
            WindowManager.shared.isTerminating,
            "WindowManager must observe app termination so close-persistence can react"
        )
    }

    func testTerminationCloseDoesNotClobberPersistedVisibility() throws {
        let id = "test.terminate.\(UUID().uuidString)"
        let windowController = TestWC(windowID: id)
        defer {
            WindowManager.shared.isTerminating = false
            WindowManager.shared.frames.clearVisibility(for: id)
        }

        windowController.showWindow()
        XCTAssertEqual(
            WindowManager.shared.frames.loadVisibility(for: id), true,
            "showWindow must persist visible = true"
        )

        // App is quitting: willTerminate has fired, then AppKit closes the
        // still-visible window. That close must not overwrite the true.
        WindowManager.shared.isTerminating = true
        windowController.windowWillClose(
            Notification(name: NSWindow.willCloseNotification, object: windowController.window)
        )

        XCTAssertEqual(
            WindowManager.shared.frames.loadVisibility(for: id), true,
            "a window closed by app termination must keep visible = true so it reopens next launch"
        )
    }

    func testUserCloseWhileRunningPersistsHidden() throws {
        let id = "test.userclose.\(UUID().uuidString)"
        let windowController = TestWC(windowID: id)
        defer { WindowManager.shared.frames.clearVisibility(for: id) }

        windowController.showWindow()
        XCTAssertEqual(WindowManager.shared.frames.loadVisibility(for: id), true)

        // Not terminating: a genuine user/programmatic close persists hidden
        // so the window stays closed on the next launch.
        XCTAssertFalse(WindowManager.shared.isTerminating)
        windowController.windowWillClose(
            Notification(name: NSWindow.willCloseNotification, object: windowController.window)
        )

        XCTAssertEqual(
            WindowManager.shared.frames.loadVisibility(for: id), false,
            "a user-initiated close while the app is running must persist hidden"
        )
    }
}

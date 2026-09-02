import AppKit
import XCTest
import AgenticDeveloperToolkitUI
@testable import AgenticToolkitMacOS

/// The `SingleWindowController` content-refit seam the config popover drives: a
/// content-hugging window is frozen at its current size while the popover is
/// open (so a slider inside it can't resize the window under the pointer), then
/// restored and refit once on close.
///
/// The popover itself lives in `AgenticDeveloperToolkitUI` and is tested there.
/// What is left here is the half only this layer can see: that
/// `SingleWindowController` satisfies `ContentRefittingWindowController`, and
/// that a popover on one of its windows actually reaches it.
@MainActor
final class SingleWindowControllerRefitSeamTests: XCTestCase {

    private final class RefitWC: SingleWindowController {
        init(id: String) {
            super.init(windowID: id, contentViewController: NSViewController())
            windowStyleMask = [.titled, .closable, .resizable]
        }
        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError() }
    }

    func testSuppressFreezesContentSizeAndResumeRestores() throws {
        let controller = RefitWC(id: "test.refit.\(UUID().uuidString)")
        controller.showWindow()
        let window = try XCTUnwrap(controller.window)
        let originalMin = window.contentMinSize
        let originalMax = window.contentMaxSize

        XCTAssertFalse(controller.isContentRefitSuppressed)
        controller.suppressContentRefit()
        XCTAssertTrue(controller.isContentRefitSuppressed)
        let frozen = window.contentRect(forFrameRect: window.frame).size
        XCTAssertEqual(window.contentMinSize, frozen, "freeze pins content min to the live size")
        XCTAssertEqual(window.contentMaxSize, frozen, "freeze pins content max to the live size")

        controller.resumeContentRefit()
        XCTAssertFalse(controller.isContentRefitSuppressed)
        XCTAssertEqual(window.contentMinSize, originalMin, "resume restores the original content min")
        XCTAssertEqual(window.contentMaxSize, originalMax, "resume restores the original content max")
    }

    func testDoubleSuppressThenResumeRestoresOriginal() throws {
        let controller = RefitWC(id: "test.refit.idem.\(UUID().uuidString)")
        controller.showWindow()
        let window = try XCTUnwrap(controller.window)
        let originalMin = window.contentMinSize
        let originalMax = window.contentMaxSize

        controller.suppressContentRefit()
        // Idempotent: a second suppress must NOT re-capture the already-frozen
        // size as the new "original" to restore.
        controller.suppressContentRefit()
        controller.resumeContentRefit()

        XCTAssertFalse(controller.isContentRefitSuppressed)
        XCTAssertEqual(window.contentMinSize, originalMin)
        XCTAssertEqual(window.contentMaxSize, originalMax)
    }

    func testPerformContentRefitNoOpWhileSuppressed() throws {
        let controller = RefitWC(id: "test.refit.noop.\(UUID().uuidString)")
        controller.showWindow()
        let window = try XCTUnwrap(controller.window)
        var providerCalls = 0
        controller.contentSizeProvider = {
            providerCalls += 1
            return NSSize(width: 999, height: 999)
        }
        controller.suppressContentRefit()
        let frameBefore = window.frame
        controller.performContentRefit()
        XCTAssertEqual(window.frame, frameBefore, "a refit while suppressed must not resize the window")
        XCTAssertEqual(providerCalls, 0, "a suppressed refit short-circuits before consulting the provider")
    }

    /// The regression this seam exists for: a window whose gear popover does
    /// not reach it resizes under the pointer as a text-size slider is dragged.
    /// The lookup runs through `gearButton.window?.windowController`, so the
    /// button has to be in the window for it to work.
    func testOpeningAPopoverInTheWindowFreezesTheRefit() throws {
        let controller = RefitWC(id: "test.refit.popover.\(UUID().uuidString)")
        controller.showWindow()
        let window = try XCTUnwrap(controller.window)

        let popover = WindowConfigPopover(title: "Window") { [NSSlider()] }
        window.contentView?.addSubview(popover.gearButton)

        popover.popoverWillShow(Notification(name: NSPopover.willShowNotification))
        XCTAssertTrue(controller.isContentRefitSuppressed, "an open popover must freeze its host window")

        popover.popoverDidClose(Notification(name: NSPopover.didCloseNotification))
        XCTAssertFalse(controller.isContentRefitSuppressed, "closing must lift the freeze")
    }
}

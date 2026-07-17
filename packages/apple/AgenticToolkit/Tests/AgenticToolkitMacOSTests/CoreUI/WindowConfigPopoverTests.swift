import AppKit
import XCTest
@testable import AgenticToolkitMacOS

/// The shared gear-button config popover every window reuses. Presentation
/// itself needs a real window (NSPopover.show), so these tests cover the pieces
/// around it: button configuration, content assembly, and the open/close hooks
/// the delegate methods drive (which in turn freeze/thaw the host window's
/// content refit — see `SingleWindowControllerRefitSeamTests`).
@MainActor
final class WindowConfigPopoverTests: XCTestCase {

    private func makePopover(controls: [NSView] = [NSButton(checkboxWithTitle: "A", target: nil, action: nil)])
        -> WindowConfigPopover {
        WindowConfigPopover(title: "Test Window", tooltip: "Tip") { controls }
    }

    func testGearButtonConfiguration() {
        let popover = makePopover()
        let button = popover.gearButton
        XCTAssertNotNil(button.image, "gear symbol image missing")
        XCTAssertFalse(button.isBordered)
        XCTAssertEqual(button.imagePosition, .imageOnly)
        XCTAssertEqual(button.toolTip, "Tip")
        XCTAssertTrue(button.target === popover, "button must target the component")
        XCTAssertFalse(popover.isShown)
    }

    func testContentAssemblyTitleThenControls() {
        let checkbox = NSButton(checkboxWithTitle: "Enabled", target: nil, action: nil)
        let slider = NSSlider()
        let content = WindowConfigPopover.ContentViewController(
            title: "My Window", controls: [checkbox, slider]
        )
        content.loadViewIfNeeded()

        guard let stack = content.view.subviews.compactMap({ $0 as? NSStackView }).first else {
            return XCTFail("content view must stack its controls")
        }
        XCTAssertEqual(stack.arrangedSubviews.count, 3, "title + 2 controls")
        XCTAssertEqual((stack.arrangedSubviews.first as? NSTextField)?.stringValue, "My Window")
        XCTAssertTrue(stack.arrangedSubviews[1] === checkbox)
        XCTAssertTrue(stack.arrangedSubviews[2] === slider)

        let width = content.view.constraints.first {
            $0.firstAttribute == .width && $0.firstItem === content.view
        }
        XCTAssertEqual(width?.constant, WindowConfigPopover.ContentViewController.popoverWidth)
    }

    func testOpenCloseHooksFire() {
        let popover = makePopover()
        var events: [String] = []
        popover.onWillShow = { events.append("show") }
        popover.onDidClose = { events.append("close") }

        // Drive the delegate methods directly — presenting a real popover needs
        // a window on screen, but the hook wiring is what windows depend on (the
        // gear button has no window here, so the internal refit suppress/resume
        // is a safe no-op).
        popover.popoverWillShow(Notification(name: NSPopover.willShowNotification))
        popover.popoverDidClose(Notification(name: NSPopover.didCloseNotification))

        XCTAssertEqual(events, ["show", "close"])
    }

    func testHooksAreOptional() {
        let popover = makePopover()
        // No hooks set — delegate calls must be safe no-ops.
        popover.popoverWillShow(Notification(name: NSPopover.willShowNotification))
        popover.popoverDidClose(Notification(name: NSPopover.didCloseNotification))
    }

    func testTitlebarAccessoryAppendsGearAfterLeadingChrome() {
        let popover = makePopover()
        let status = NSTextField(labelWithString: "Updated")
        let refresh = NSButton()
        let accessory = popover.makeTitlebarAccessory(leading: [status, refresh])

        // Right-aligned in the title bar, with an explicit non-zero frame (a
        // pure-autolayout accessory renders at zero width and disappears).
        XCTAssertEqual(accessory.layoutAttribute, .right)
        XCTAssertGreaterThan(accessory.view.frame.width, 0)

        guard let row = accessory.view.subviews.compactMap({ $0 as? NSStackView }).first else {
            return XCTFail("accessory must stack its chrome")
        }
        XCTAssertEqual(row.arrangedSubviews.count, 3, "leading views + gear")
        XCTAssertTrue(row.arrangedSubviews[0] === status)
        XCTAssertTrue(row.arrangedSubviews[1] === refresh)
        XCTAssertTrue(row.arrangedSubviews[2] === popover.gearButton, "gear is always last (rightmost)")
    }

    func testTitlebarAccessoryIsGearOnlyWithoutLeadingChrome() {
        let popover = makePopover()
        let accessory = popover.makeTitlebarAccessory()
        guard let row = accessory.view.subviews.compactMap({ $0 as? NSStackView }).first else {
            return XCTFail("accessory must stack its chrome")
        }
        XCTAssertEqual(row.arrangedSubviews.count, 1)
        XCTAssertTrue(row.arrangedSubviews[0] === popover.gearButton)
    }
}

/// The `SingleWindowController` content-refit seam the config popover drives: a
/// content-hugging window is frozen at its current size while the popover is
/// open (so a slider inside it can't resize the window under the pointer), then
/// restored and refit once on close.
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
}

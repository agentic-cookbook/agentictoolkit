import AppKit
import XCTest
@testable import AgenticToolkitMacOS

/// A content-hugging window is sized for the screen it is on: its fit is
/// clamped to the room between its top-left anchor and that screen's edges.
/// Moving it changes that room, so the fit has to be recomputed — otherwise a
/// window dragged toward an edge (or onto a smaller display) keeps a size that
/// no longer fits, and one dragged into room it didn't have keeps a clamp that
/// no longer applies.
@MainActor
final class SingleWindowControllerMoveRefitTests: XCTestCase {

    private final class HuggingWC: SingleWindowController {
        init(id: String) {
            super.init(windowID: id, contentViewController: NSViewController())
            windowStyleMask = [.titled, .closable]
            minSize = NSSize(width: 120, height: 80)
        }
        @available(*, unavailable)
        required init?(coder: NSCoder) { fatalError() }
    }

    private let contentSize = NSSize(width: 400, height: 300)

    private func makeShownController() throws -> (HuggingWC, NSWindow, NSRect) {
        let controller = HuggingWC(id: "test.move.refit.\(UUID().uuidString)")
        controller.showWindow()
        let window = try XCTUnwrap(controller.window)
        let visible = try XCTUnwrap(window.screen ?? NSScreen.main).visibleFrame
        controller.contentSizeProvider = { [contentSize] in contentSize }
        return (controller, window, visible)
    }

    /// The frame size the window takes when the content fits with room to spare.
    private func fittedSize(of window: NSWindow) -> NSSize {
        window.frameRect(forContentRect: NSRect(origin: .zero, size: contentSize)).size
    }

    /// How far past the right edge the "no longer fits" position hangs. Small
    /// on purpose: the fit is computed against whichever screen holds most of
    /// the window, and this machine may well have a display to the right, so
    /// the window has to stay overwhelmingly on the one it is being tested on.
    private let overhang: CGFloat = 40

    /// Parks the window `roomToTheRight` points from the visible area's right
    /// edge, high enough that vertical room is never the binding constraint.
    private func park(_ window: NSWindow, in visible: NSRect, roomToTheRight: CGFloat) {
        let size = fittedSize(of: window)
        window.setFrame(
            NSRect(x: visible.maxX - roomToTheRight,
                   y: visible.maxY - 60 - size.height,
                   width: size.width,
                   height: size.height),
            display: false
        )
    }

    func testOnlyAContentHuggingWindowRefitsAfterAMove() throws {
        let controller = HuggingWC(id: "test.move.gate.\(UUID().uuidString)")
        controller.showWindow()

        XCTAssertFalse(
            controller.wantsRefitAfterMove,
            "a window with no content-size provider doesn't own its size — a move is just a move"
        )
        controller.contentSizeProvider = { NSSize(width: 320, height: 200) }
        XCTAssertTrue(controller.wantsRefitAfterMove)

        controller.suppressContentRefit()
        XCTAssertFalse(
            controller.wantsRefitAfterMove,
            "a window frozen behind an open config popover stays frozen through a move"
        )
        controller.resumeContentRefit()
        XCTAssertTrue(controller.wantsRefitAfterMove)
    }

    func testTheFitIsRecomputedAfterAMoveEvenThoughTheContentDidNotChange() throws {
        let (controller, window, visible) = try makeShownController()

        // Fit once with room to spare: the window now measures exactly what the
        // content asked for, which is the case a size-only bail short-circuits.
        let wanted = fittedSize(of: window)
        park(window, in: visible, roomToTheRight: wanted.width + 80)
        controller.performContentRefit()
        XCTAssertEqual(window.frame.size, wanted, "fits outright when there is room")

        // Move it so the content no longer fits between the anchor and the
        // edge. The content still wants the same size; the screen no longer
        // has it.
        let room = wanted.width - overhang
        park(window, in: visible, roomToTheRight: room)
        controller.performContentRefit()
        XCTAssertEqual(window.frame.width, room, "the fit is clamped to the room the new position has")
        XCTAssertEqual(window.frame.minX, visible.maxX - room, "the anchor the user chose is kept")
    }

    func testAMoveNotificationDrivesTheRefitOnItsOwn() throws {
        let (controller, window, visible) = try makeShownController()
        let wanted = fittedSize(of: window)
        park(window, in: visible, roomToTheRight: wanted.width + 80)
        controller.performContentRefit()

        // Exactly what a drag toward the right edge does: origin changes, size
        // doesn't. `windowDidMove` schedules the settle; nothing else runs.
        let room = wanted.width - overhang
        window.setFrame(
            NSRect(origin: NSPoint(x: visible.maxX - room, y: window.frame.minY),
                   size: window.frame.size),
            display: false
        )

        let deadline = Date().addingTimeInterval(3)
        while Date() < deadline, window.frame.width > room {
            RunLoop.current.run(until: Date().addingTimeInterval(0.02))
        }
        XCTAssertEqual(window.frame.width, room, "the move alone re-fit the window")
    }
}

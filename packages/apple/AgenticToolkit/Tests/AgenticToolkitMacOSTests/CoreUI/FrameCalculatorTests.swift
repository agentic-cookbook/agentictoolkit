import XCTest
@testable import AgenticToolkitMacOS

final class FrameCalculatorTests: XCTestCase {

    // MARK: - Proportional Position

    func testProportionalPositionCenter() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let window = NSRect(x: 760, y: 340, width: 400, height: 400)
        let pos = FrameCalculator.proportionalPosition(windowFrame: window, screenVisibleFrame: screen)
        XCTAssertEqual(pos.x, 0.5, accuracy: 0.01)
        XCTAssertEqual(pos.y, 0.5, accuracy: 0.01)
    }

    func testProportionalPositionTopRight() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let window = NSRect(x: 1520, y: 680, width: 400, height: 400)
        let pos = FrameCalculator.proportionalPosition(windowFrame: window, screenVisibleFrame: screen)
        XCTAssertEqual(pos.x, 1.0, accuracy: 0.01)
        XCTAssertEqual(pos.y, 1.0, accuracy: 0.01)
    }

    func testProportionalPositionBottomLeft() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let window = NSRect(x: 0, y: 0, width: 400, height: 400)
        let pos = FrameCalculator.proportionalPosition(windowFrame: window, screenVisibleFrame: screen)
        XCTAssertEqual(pos.x, 0.0, accuracy: 0.01)
        XCTAssertEqual(pos.y, 0.0, accuracy: 0.01)
    }

    func testProportionalPositionWindowFillsScreen() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let window = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let pos = FrameCalculator.proportionalPosition(windowFrame: window, screenVisibleFrame: screen)
        XCTAssertEqual(pos.x, 0.5)
        XCTAssertEqual(pos.y, 0.5)
    }

    // MARK: - Absolute Frame

    func testAbsoluteFrameCenter() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = FrameCalculator.absoluteFrame(
            proportionalX: 0.5, proportionalY: 0.5,
            width: 600, height: 480,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(frame.origin.x, 660, accuracy: 1)
        XCTAssertEqual(frame.origin.y, 300, accuracy: 1)
        XCTAssertEqual(frame.width, 600)
        XCTAssertEqual(frame.height, 480)
    }

    func testAbsoluteFrameTopRight() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = FrameCalculator.absoluteFrame(
            proportionalX: 1.0, proportionalY: 1.0,
            width: 400, height: 300,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(frame.origin.x, 1520, accuracy: 1)
        XCTAssertEqual(frame.origin.y, 780, accuracy: 1)
    }

    func testAbsoluteFrameClampsToMinSize() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = FrameCalculator.absoluteFrame(
            proportionalX: 0.5, proportionalY: 0.5,
            width: 50, height: 50,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 200, height: 200)
        )
        XCTAssertEqual(frame.width, 200)
        XCTAssertEqual(frame.height, 200)
    }

    func testAbsoluteFrameClampsToScreenSize() {
        let screen = NSRect(x: 0, y: 0, width: 800, height: 600)
        let frame = FrameCalculator.absoluteFrame(
            proportionalX: 0.5, proportionalY: 0.5,
            width: 1200, height: 900,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(frame.width, 800)
        XCTAssertEqual(frame.height, 600)
    }

    func testAbsoluteFrameWithScreenOffset() {
        let screen = NSRect(x: 1920, y: 0, width: 1920, height: 1080)
        let frame = FrameCalculator.absoluteFrame(
            proportionalX: 0.5, proportionalY: 0.5,
            width: 600, height: 480,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(frame.origin.x, 1920 + 660, accuracy: 1)
    }

    // MARK: - Roundtrip

    func testProportionalRoundtrip() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let originalFrame = NSRect(x: 300, y: 200, width: 600, height: 480)

        let pos = FrameCalculator.proportionalPosition(windowFrame: originalFrame, screenVisibleFrame: screen)
        let restored = FrameCalculator.absoluteFrame(
            proportionalX: pos.x, proportionalY: pos.y,
            width: originalFrame.width, height: originalFrame.height,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )

        XCTAssertEqual(restored.origin.x, originalFrame.origin.x, accuracy: 1)
        XCTAssertEqual(restored.origin.y, originalFrame.origin.y, accuracy: 1)
        XCTAssertEqual(restored.width, originalFrame.width)
        XCTAssertEqual(restored.height, originalFrame.height)
    }

    func testProportionalRoundtripOnSecondaryScreen() {
        let screen = NSRect(x: 1920, y: -200, width: 2560, height: 1440)
        let originalFrame = NSRect(x: 3800, y: 800, width: 500, height: 400)

        let pos = FrameCalculator.proportionalPosition(windowFrame: originalFrame, screenVisibleFrame: screen)
        let restored = FrameCalculator.absoluteFrame(
            proportionalX: pos.x, proportionalY: pos.y,
            width: originalFrame.width, height: originalFrame.height,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )

        XCTAssertEqual(restored.origin.x, originalFrame.origin.x, accuracy: 1)
        XCTAssertEqual(restored.origin.y, originalFrame.origin.y, accuracy: 1)
    }

    // MARK: - Frame Validation

    func testValidateFrameFullyOnScreen() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: 100, y: 100, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(
            frame,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(result, frame)
    }

    func testValidateFramePushesFromRight() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: 1800, y: 100, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(
            frame,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(result.maxX, 1920, accuracy: 1)
        XCTAssertEqual(result.width, 400)
    }

    func testValidateFramePushesFromTop() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: 100, y: 900, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(
            frame,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(result.maxY, 1080, accuracy: 1)
    }

    func testValidateFramePushesFromLeft() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: -100, y: 100, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(
            frame,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(result.origin.x, 0)
    }

    func testValidateFramePushesFromBottom() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: 100, y: -50, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(
            frame,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(result.origin.y, 0)
    }

    func testValidateFrameEnforcesMinSize() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: 100, y: 100, width: 50, height: 30)
        let result = FrameCalculator.validateFrame(
            frame,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 200, height: 150)
        )
        XCTAssertEqual(result.width, 200)
        XCTAssertEqual(result.height, 150)
    }

    func testValidateFrameClampsOversizeToScreen() {
        let screen = NSRect(x: 0, y: 0, width: 800, height: 600)
        let frame = NSRect(x: 0, y: 0, width: 1200, height: 900)
        let result = FrameCalculator.validateFrame(
            frame,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(result.width, 800)
        XCTAssertEqual(result.height, 600)
    }

    func testValidateFrameWithMenuBarOffset() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1055)
        let frame = NSRect(x: 100, y: 900, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(
            frame,
            screenVisibleFrame: screen,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertLessThanOrEqual(result.maxY, 1055)
    }

    // MARK: - Default Frame

    func testDefaultFrameCenter() {
        let spec = WindowSpec(
            defaultSize: NSSize(width: 600, height: 480),
            minSize: NSSize(width: 100, height: 100),
            defaultPosition: .center,
            persistsFrame: true
        )
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = FrameCalculator.defaultFrame(spec: spec, screenVisibleFrame: screen)
        XCTAssertEqual(frame.origin.x, 660, accuracy: 1)
        XCTAssertEqual(frame.origin.y, 300, accuracy: 1)
    }

    func testDefaultFrameTopRight() {
        let spec = WindowSpec(
            defaultSize: NSSize(width: 340, height: 300),
            minSize: NSSize(width: 280, height: 120),
            defaultPosition: .topRight,
            persistsFrame: true
        )
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = FrameCalculator.defaultFrame(spec: spec, screenVisibleFrame: screen)
        XCTAssertEqual(frame.origin.x, 1342, accuracy: 1)
        XCTAssertEqual(frame.origin.y, 663, accuracy: 1)
    }

    // MARK: - Top-left offset (user-POV: y grows downward)

    func testTopLeftOffsetAtScreenTopLeftIsZero() {
        // Menu-bar inset screen: visible top is y=1055 in macOS coords.
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1055)
        let window = NSRect(x: 0, y: 1055 - 300, width: 500, height: 300)
        let offset = FrameCalculator.topLeftOffset(windowFrame: window, screenVisibleFrame: visible)
        XCTAssertEqual(offset.x, 0)
        XCTAssertEqual(offset.y, 0)
    }

    func testTopLeftOffsetMeasuresDownFromVisibleTop() {
        let visible = NSRect(x: 100, y: 50, width: 1920, height: 1000)
        // Window top-left 60pt right of and 40pt below the visible top-left.
        let window = NSRect(x: 160, y: 50 + 1000 - 40 - 300, width: 500, height: 300)
        let offset = FrameCalculator.topLeftOffset(windowFrame: window, screenVisibleFrame: visible)
        XCTAssertEqual(offset.x, 60)
        XCTAssertEqual(offset.y, 40)
    }

    func testTopLeftOffsetRoundTrip() {
        let visible = NSRect(x: -800, y: 200, width: 2560, height: 1400)
        let original = NSRect(x: -300, y: 700, width: 640, height: 420)
        let offset = FrameCalculator.topLeftOffset(windowFrame: original, screenVisibleFrame: visible)
        let rebuilt = FrameCalculator.frame(
            topLeftOffset: offset, size: original.size, screenVisibleFrame: visible
        )
        XCTAssertEqual(rebuilt, original)
    }

    func testTopLeftAnchorSurvivesHeightChange() {
        // The drift bug's root: growing height with a fixed top edge must
        // not change the persisted anchor.
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let short = NSRect(x: 250, y: 800 - 260, width: 500, height: 260)
        let tall = NSRect(x: 250, y: 800 - 420, width: 500, height: 420)
        XCTAssertEqual(
            FrameCalculator.topLeftOffset(windowFrame: short, screenVisibleFrame: visible),
            FrameCalculator.topLeftOffset(windowFrame: tall, screenVisibleFrame: visible)
        )
    }

    // MARK: - Relative position (0,0 = top-left … 1,1 = bottom-right)

    func testRelativePositionCorners() {
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let size = NSSize(width: 600, height: 480)

        let topLeft = NSRect(x: 0, y: 1080 - 480, width: 600, height: 480)
        XCTAssertEqual(
            FrameCalculator.relativePosition(windowFrame: topLeft, screenVisibleFrame: visible),
            CGPoint(x: 0, y: 0)
        )

        let bottomRight = NSRect(x: 1920 - 600, y: 0, width: size.width, height: size.height)
        XCTAssertEqual(
            FrameCalculator.relativePosition(windowFrame: bottomRight, screenVisibleFrame: visible),
            CGPoint(x: 1, y: 1)
        )

        let bottomLeft = NSRect(x: 0, y: 0, width: 600, height: 480)
        XCTAssertEqual(
            FrameCalculator.relativePosition(windowFrame: bottomLeft, screenVisibleFrame: visible),
            CGPoint(x: 0, y: 1)
        )

        let centered = NSRect(x: 660, y: 300, width: 600, height: 480)
        XCTAssertEqual(
            FrameCalculator.relativePosition(windowFrame: centered, screenVisibleFrame: visible),
            CGPoint(x: 0.5, y: 0.5)
        )
    }

    func testRelativePositionClampsOffscreenTo0And1() {
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let hangingOff = NSRect(x: -200, y: -300, width: 600, height: 480)
        let position = FrameCalculator.relativePosition(windowFrame: hangingOff, screenVisibleFrame: visible)
        XCTAssertEqual(position.x, 0)
        XCTAssertEqual(position.y, 1)
    }

    func testRelativePositionCenteredWhenNoTravel() {
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let fullSize = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let position = FrameCalculator.relativePosition(windowFrame: fullSize, screenVisibleFrame: visible)
        XCTAssertEqual(position, CGPoint(x: 0.5, y: 0.5))
    }

    func testFrameFromRelativePositionRoundTrip() {
        let visible = NSRect(x: 100, y: 70, width: 1920, height: 985)
        let original = NSRect(x: 500, y: 300, width: 640, height: 400)
        let relative = FrameCalculator.relativePosition(windowFrame: original, screenVisibleFrame: visible)
        let rebuilt = FrameCalculator.frame(
            relativePosition: relative,
            size: original.size,
            screenVisibleFrame: visible,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(rebuilt.origin.x, original.origin.x, accuracy: 0.001)
        XCTAssertEqual(rebuilt.origin.y, original.origin.y, accuracy: 0.001)
    }

    func testFrameFromRelativePositionClampsSizeToScreen() {
        let visible = NSRect(x: 0, y: 0, width: 800, height: 600)
        let frame = FrameCalculator.frame(
            relativePosition: CGPoint(x: 0.5, y: 0.5),
            size: NSSize(width: 1200, height: 900),
            screenVisibleFrame: visible,
            minSize: NSSize(width: 100, height: 100)
        )
        XCTAssertEqual(frame.size, NSSize(width: 800, height: 600))
    }

    // MARK: - Content-hugging growth (top-left fixed, grows down + right)

    private let hugMinSize = NSSize(width: 200, height: 100)

    func testContentHuggingGrowsDownAndRight() {
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let current = NSRect(x: 250, y: 800 - 260, width: 500, height: 260)
        for policy in [WindowSpec.OverflowPolicy.scrollContent, .moveToDisclose] {
            let grown = FrameCalculator.contentHuggingFrame(
                currentFrame: current,
                desiredFrameSize: NSSize(width: 560, height: 420),
                screenVisibleFrame: visible,
                policy: policy,
                minSize: hugMinSize
            )
            XCTAssertEqual(grown.minX, 250, "left edge stays fixed (\(policy))")
            XCTAssertEqual(grown.maxY, 800, "top edge stays fixed (\(policy))")
            XCTAssertEqual(grown.size, NSSize(width: 560, height: 420))
        }
    }

    func testContentHuggingScrollContentStopsAtScreenEdge() {
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        // Anchored 300pt from the right edge and 200pt above the bottom.
        let current = NSRect(x: 1620, y: 200 - 150, width: 200, height: 150)
        let grown = FrameCalculator.contentHuggingFrame(
            currentFrame: current,
            desiredFrameSize: NSSize(width: 800, height: 600),
            screenVisibleFrame: visible,
            policy: .scrollContent,
            minSize: hugMinSize
        )
        XCTAssertEqual(grown.minX, 1620, "window must not move")
        XCTAssertEqual(grown.maxY, 200, "window must not move")
        XCTAssertEqual(grown.width, 300, "growth stops at the right edge")
        XCTAssertEqual(grown.height, 200, "growth stops at the bottom edge")
    }

    func testContentHuggingScrollContentKeepsMinSizeWhenNoRoom() {
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        // Anchor so close to the corner that even minSize overhangs.
        let current = NSRect(x: 1820, y: 50 - 40, width: 90, height: 40)
        let grown = FrameCalculator.contentHuggingFrame(
            currentFrame: current,
            desiredFrameSize: NSSize(width: 800, height: 600),
            screenVisibleFrame: visible,
            policy: .scrollContent,
            minSize: hugMinSize
        )
        XCTAssertEqual(grown.size, hugMinSize, "never collapse below minSize")
        XCTAssertEqual(grown.minX, 1820)
        XCTAssertEqual(grown.maxY, 50)
    }

    func testContentHuggingMoveToDiscloseMovesMinimally() {
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        // Same anchor as the scroll test: desired 800×600 overflows by 500
        // right and 400 down.
        let current = NSRect(x: 1620, y: 200 - 150, width: 200, height: 150)
        let grown = FrameCalculator.contentHuggingFrame(
            currentFrame: current,
            desiredFrameSize: NSSize(width: 800, height: 600),
            screenVisibleFrame: visible,
            policy: .moveToDisclose,
            minSize: hugMinSize
        )
        XCTAssertEqual(grown.size, NSSize(width: 800, height: 600), "size is kept")
        XCTAssertEqual(grown.minX, 1920 - 800, "moved left just enough to disclose")
        XCTAssertEqual(grown.minY, 0, "moved up just enough to disclose")
    }

    func testContentHuggingMoveToDiscloseDoesNotMoveWhenItFits() {
        let visible = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let current = NSRect(x: 250, y: 800 - 260, width: 500, height: 260)
        let grown = FrameCalculator.contentHuggingFrame(
            currentFrame: current,
            desiredFrameSize: NSSize(width: 500, height: 260),
            screenVisibleFrame: visible,
            policy: .moveToDisclose,
            minSize: hugMinSize
        )
        XCTAssertEqual(grown, current)
    }
}

import XCTest
@testable import AgenticAppKit

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
        let result = FrameCalculator.validateFrame(frame, screenVisibleFrame: screen, minSize: NSSize(width: 100, height: 100))
        XCTAssertEqual(result, frame)
    }

    func testValidateFramePushesFromRight() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: 1800, y: 100, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(frame, screenVisibleFrame: screen, minSize: NSSize(width: 100, height: 100))
        XCTAssertEqual(result.maxX, 1920, accuracy: 1)
        XCTAssertEqual(result.width, 400)
    }

    func testValidateFramePushesFromTop() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: 100, y: 900, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(frame, screenVisibleFrame: screen, minSize: NSSize(width: 100, height: 100))
        XCTAssertEqual(result.maxY, 1080, accuracy: 1)
    }

    func testValidateFramePushesFromLeft() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: -100, y: 100, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(frame, screenVisibleFrame: screen, minSize: NSSize(width: 100, height: 100))
        XCTAssertEqual(result.origin.x, 0)
    }

    func testValidateFramePushesFromBottom() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: 100, y: -50, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(frame, screenVisibleFrame: screen, minSize: NSSize(width: 100, height: 100))
        XCTAssertEqual(result.origin.y, 0)
    }

    func testValidateFrameEnforcesMinSize() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1080)
        let frame = NSRect(x: 100, y: 100, width: 50, height: 30)
        let result = FrameCalculator.validateFrame(frame, screenVisibleFrame: screen, minSize: NSSize(width: 200, height: 150))
        XCTAssertEqual(result.width, 200)
        XCTAssertEqual(result.height, 150)
    }

    func testValidateFrameClampsOversizeToScreen() {
        let screen = NSRect(x: 0, y: 0, width: 800, height: 600)
        let frame = NSRect(x: 0, y: 0, width: 1200, height: 900)
        let result = FrameCalculator.validateFrame(frame, screenVisibleFrame: screen, minSize: NSSize(width: 100, height: 100))
        XCTAssertEqual(result.width, 800)
        XCTAssertEqual(result.height, 600)
    }

    func testValidateFrameWithMenuBarOffset() {
        let screen = NSRect(x: 0, y: 0, width: 1920, height: 1055)
        let frame = NSRect(x: 100, y: 900, width: 400, height: 300)
        let result = FrameCalculator.validateFrame(frame, screenVisibleFrame: screen, minSize: NSSize(width: 100, height: 100))
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
}

import XCTest
@testable import AgenticPluginTester
@testable import AgenticAppKit

// MARK: - Mock Screen

/// A mock screen for testing proportional positioning across screen changes.
struct MockScreen: ScreenInfo {
    let frame: NSRect
    let visibleFrame: NSRect
    let fingerprint: ScreenFingerprint

    init(
        frame: NSRect,
        visibleFrame: NSRect? = nil,
        uuid: String? = nil,
        name: String? = nil,
        isMain: Bool = false
    ) {
        self.frame = frame
        self.visibleFrame = visibleFrame ?? frame
        self.fingerprint = ScreenFingerprint(
            displayUUID: uuid,
            localizedName: name,
            resolutionWidth: frame.width,
            resolutionHeight: frame.height,
            isMain: isMain
        )
    }
}

// MARK: - Mock Screen Provider

/// Provides a configurable set of mock screens.
class MockScreenProvider: ScreenProvider {
    var screens: [ScreenInfo]
    var mainScreen: ScreenInfo?

    init(screens: [MockScreen] = []) {
        self.screens = screens
        self.mainScreen = screens.first(where: { $0.fingerprint.isMain })
            ?? screens.first
    }
}

// MARK: - Mock Storage

/// In-memory storage for testing persistence across simulated relaunches.
class MockStorage: WindowStateStorage {
    var states: [String: PersistedWindowState] = [:]

    func loadState(for id: String) -> PersistedWindowState? {
        states[id]
    }

    func saveState(_ state: PersistedWindowState, for id: String) {
        states[id] = state
    }

    func removeState(for id: String) {
        states[id] = nil
    }
}

// MARK: - Frame Calculator Tests

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
        // When window fills screen, should default to 0.5
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
        // Secondary screen positioned to the right
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
        // visibleFrame is shorter due to menu bar (25px)
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
        // 0.85 * (1920 - 340) = 1342, 0.85 * (1080 - 300) = 663
        XCTAssertEqual(frame.origin.x, 1342, accuracy: 1)
        XCTAssertEqual(frame.origin.y, 663, accuracy: 1)
    }
}

// MARK: - Screen Matcher Tests

final class ScreenMatcherTests: XCTestCase {

    func testExactMatchByUUIDAndResolution() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "ABC-123",
            localizedName: "Built-in Display",
            resolutionWidth: 1920,
            resolutionHeight: 1080,
            isMain: true
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "ABC-123", name: "Built-in Display", isMain: true
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertEqual(match?.quality, .exact)
    }

    func testUUIDMatchWithResolutionChange() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "ABC-123",
            localizedName: "Built-in Display",
            resolutionWidth: 1920,
            resolutionHeight: 1080,
            isMain: true
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 2560, height: 1440),
            uuid: "ABC-123", name: "Built-in Display", isMain: true
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertEqual(match?.quality, .uuidResChanged)
    }

    func testNameMatchWhenUUIDDiffers() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "OLD-UUID",
            localizedName: "LG UltraFine",
            resolutionWidth: 3840,
            resolutionHeight: 2160,
            isMain: false
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 3840, height: 2160),
            uuid: "NEW-UUID", name: "LG UltraFine", isMain: false
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertEqual(match?.quality, .nameOnly)
    }

    func testPositionMatchMainScreen() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "GONE-UUID",
            localizedName: "Disconnected Monitor",
            resolutionWidth: 2560,
            resolutionHeight: 1440,
            isMain: true
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "DIFFERENT", name: "Built-in Display", isMain: true
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertEqual(match?.quality, .positionOnly)
    }

    func testNoMatchReturnsNil() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "GONE-UUID",
            localizedName: "Disconnected Monitor",
            resolutionWidth: 2560,
            resolutionHeight: 1440,
            isMain: false
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "DIFFERENT", name: "Built-in Display", isMain: false
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertNil(match)
    }

    func testBestMatchSelectedFromMultipleScreens() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "TARGET-UUID",
            localizedName: "External",
            resolutionWidth: 2560,
            resolutionHeight: 1440,
            isMain: false
        )

        let builtin = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "BUILTIN", name: "Built-in Display", isMain: true
        )
        let external = MockScreen(
            frame: NSRect(x: 1920, y: 0, width: 2560, height: 1440),
            uuid: "TARGET-UUID", name: "External", isMain: false
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [builtin, external])
        XCTAssertEqual(match?.quality, .exact)
        XCTAssertEqual(match?.screen.frame, external.frame)
    }

    func testPreferUUIDOverName() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "UUID-A",
            localizedName: "Shared Name",
            resolutionWidth: 1920,
            resolutionHeight: 1080,
            isMain: false
        )

        let nameMatch = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "UUID-B", name: "Shared Name", isMain: false
        )
        let uuidMatch = MockScreen(
            frame: NSRect(x: 1920, y: 0, width: 2560, height: 1440),
            uuid: "UUID-A", name: "Different Name", isMain: false
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [nameMatch, uuidMatch])
        XCTAssertEqual(match?.quality, .uuidResChanged)
        XCTAssertEqual(match?.screen.frame, uuidMatch.frame)
    }
}

// MARK: - Simulated Relaunch Tests

final class WindowManagerSimulatedRelaunchTests: XCTestCase {

    /// Simulates saving on one screen config, then restoring on a different one.
    /// Uses shared MockStorage to persist state "across relaunches."

    func testRestorationOnSameScreen() {
        let storage = MockStorage()
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "MAIN", name: "Built-in", isMain: true
        )

        // "Launch 1": save a window at a specific position
        let state = makeState(propX: 0.7, propY: 0.3, width: 600, height: 480, screen: screen)
        storage.saveState(state, for: "test")

        // "Launch 2": restore on same screen
        let provider = MockScreenProvider(screens: [screen])
        let wm = WindowManager(screenProvider: provider, storage: storage)
        wm.register(id: "test", spec: WindowSpec(
            defaultSize: NSSize(width: 600, height: 480),
            minSize: NSSize(width: 200, height: 200),
            defaultPosition: .center,
            persistsFrame: true
        ))

        let loaded = storage.loadState(for: "test")!
        let restored = FrameCalculator.absoluteFrame(
            proportionalX: loaded.proportionalX,
            proportionalY: loaded.proportionalY,
            width: loaded.width,
            height: loaded.height,
            screenVisibleFrame: screen.visibleFrame,
            minSize: NSSize(width: 200, height: 200)
        )

        // Should be at 70% from left, 30% from bottom
        let expectedX = 0.7 * (1920 - 600)
        let expectedY = 0.3 * (1080 - 480)
        XCTAssertEqual(restored.origin.x, expectedX, accuracy: 1)
        XCTAssertEqual(restored.origin.y, expectedY, accuracy: 1)
    }

    func testRestorationAfterResolutionIncrease() {
        let storage = MockStorage()

        let oldScreen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "MAIN", name: "Built-in", isMain: true
        )
        let newScreen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 2560, height: 1440),
            uuid: "MAIN", name: "Built-in", isMain: true
        )

        // Save at bottom-right corner on 1920x1080
        let state = makeState(propX: 1.0, propY: 0.0, width: 600, height: 480, screen: oldScreen)
        storage.saveState(state, for: "test")

        // Restore on 2560x1440 — should still be at bottom-right
        let loaded = storage.loadState(for: "test")!

        // Screen matcher should find UUID match with resolution change
        let match = ScreenMatcher.findBestMatch(for: loaded.screenFingerprint, among: [newScreen])
        XCTAssertEqual(match?.quality, .uuidResChanged)

        let restored = FrameCalculator.absoluteFrame(
            proportionalX: loaded.proportionalX,
            proportionalY: loaded.proportionalY,
            width: loaded.width,
            height: loaded.height,
            screenVisibleFrame: newScreen.visibleFrame,
            minSize: NSSize(width: 200, height: 200)
        )

        // propX=1.0 → right edge: x = 2560 - 600 = 1960
        XCTAssertEqual(restored.origin.x, 1960, accuracy: 1)
        // propY=0.0 → bottom edge: y = 0
        XCTAssertEqual(restored.origin.y, 0, accuracy: 1)
    }

    func testRestorationAfterResolutionDecrease() {
        let storage = MockStorage()

        let oldScreen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 2560, height: 1440),
            uuid: "MAIN", name: "Built-in", isMain: true
        )
        let newScreen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1440, height: 900),
            uuid: "MAIN", name: "Built-in", isMain: true
        )

        // Save centered on large screen
        let state = makeState(propX: 0.5, propY: 0.5, width: 600, height: 480, screen: oldScreen)
        storage.saveState(state, for: "test")

        let loaded = storage.loadState(for: "test")!
        let restored = FrameCalculator.absoluteFrame(
            proportionalX: loaded.proportionalX,
            proportionalY: loaded.proportionalY,
            width: loaded.width,
            height: loaded.height,
            screenVisibleFrame: newScreen.visibleFrame,
            minSize: NSSize(width: 200, height: 200)
        )

        // Should be centered on smaller screen
        XCTAssertEqual(restored.origin.x, (1440 - 600) / 2, accuracy: 1)
        XCTAssertEqual(restored.origin.y, (900 - 480) / 2, accuracy: 1)
    }

    func testRestorationWhenScreenDisconnected() {
        let storage = MockStorage()

        let externalScreen = MockScreen(
            frame: NSRect(x: 1920, y: 0, width: 2560, height: 1440),
            uuid: "EXTERNAL", name: "LG Monitor", isMain: false
        )
        let builtinScreen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "BUILTIN", name: "Built-in", isMain: true
        )

        // Save on external monitor at top-right
        let state = makeState(propX: 0.9, propY: 0.9, width: 600, height: 480, screen: externalScreen)
        storage.saveState(state, for: "test")

        // Relaunch with only built-in (external disconnected)
        let loaded = storage.loadState(for: "test")!
        let match = ScreenMatcher.findBestMatch(for: loaded.screenFingerprint, among: [builtinScreen])
        XCTAssertNil(match, "External screen UUID should not match built-in")

        // Falls back to main screen, but preserves proportional position
        let fallbackScreen = builtinScreen
        let restored = FrameCalculator.absoluteFrame(
            proportionalX: loaded.proportionalX,
            proportionalY: loaded.proportionalY,
            width: loaded.width,
            height: loaded.height,
            screenVisibleFrame: fallbackScreen.visibleFrame,
            minSize: NSSize(width: 200, height: 200)
        )

        // Should be at top-right of built-in screen
        let expectedX = 0.9 * (1920 - 600)
        let expectedY = 0.9 * (1080 - 480)
        XCTAssertEqual(restored.origin.x, expectedX, accuracy: 1)
        XCTAssertEqual(restored.origin.y, expectedY, accuracy: 1)

        // Validate it fits
        let validated = FrameCalculator.validateFrame(
            restored,
            screenVisibleFrame: fallbackScreen.visibleFrame,
            minSize: NSSize(width: 200, height: 200)
        )
        XCTAssertLessThanOrEqual(validated.maxX, 1920)
        XCTAssertLessThanOrEqual(validated.maxY, 1080)
    }

    func testRestorationWhenScreenShrinksMakesWindowTooLarge() {
        let storage = MockStorage()

        let oldScreen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 2560, height: 1440),
            uuid: "MAIN", name: "Built-in", isMain: true
        )
        let newScreen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 800, height: 600),
            uuid: "MAIN", name: "Built-in", isMain: true
        )

        // Save with a large window
        let state = makeState(propX: 0.5, propY: 0.5, width: 1200, height: 900, screen: oldScreen)
        storage.saveState(state, for: "test")

        let loaded = storage.loadState(for: "test")!
        let restored = FrameCalculator.absoluteFrame(
            proportionalX: loaded.proportionalX,
            proportionalY: loaded.proportionalY,
            width: loaded.width,
            height: loaded.height,
            screenVisibleFrame: newScreen.visibleFrame,
            minSize: NSSize(width: 200, height: 200)
        )

        // Width/height should be clamped to screen
        XCTAssertEqual(restored.width, 800)
        XCTAssertEqual(restored.height, 600)
    }

    func testRestorationWithMenuBarAndDock() {
        let storage = MockStorage()

        // Full frame is 1920x1080 but visible is smaller due to menu bar (25px) and dock (70px)
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            visibleFrame: NSRect(x: 0, y: 70, width: 1920, height: 985),
            uuid: "MAIN", name: "Built-in", isMain: true
        )

        // Save at center of visible area
        let state = makeState(propX: 0.5, propY: 0.5, width: 600, height: 480, screen: screen)
        storage.saveState(state, for: "test")

        let loaded = storage.loadState(for: "test")!
        let restored = FrameCalculator.absoluteFrame(
            proportionalX: loaded.proportionalX,
            proportionalY: loaded.proportionalY,
            width: loaded.width,
            height: loaded.height,
            screenVisibleFrame: screen.visibleFrame,
            minSize: NSSize(width: 200, height: 200)
        )

        // Should be centered within the visible frame (which starts at y=70)
        XCTAssertEqual(restored.origin.x, (1920 - 600) / 2, accuracy: 1)
        let expectedY = 70 + (985 - 480) / 2
        XCTAssertEqual(restored.origin.y, expectedY, accuracy: 1)
        XCTAssertGreaterThanOrEqual(restored.origin.y, 70) // Above dock
        XCTAssertLessThanOrEqual(restored.maxY, 70 + 985)   // Below menu bar
    }

    func testRestorationOnMultiMonitorWithCorrectScreenMatch() {
        let storage = MockStorage()

        let leftScreen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "LEFT", name: "Left Monitor", isMain: true
        )
        let rightScreen = MockScreen(
            frame: NSRect(x: 1920, y: 0, width: 2560, height: 1440),
            uuid: "RIGHT", name: "Right Monitor", isMain: false
        )

        // Save on right screen
        let state = makeState(propX: 0.5, propY: 0.5, width: 600, height: 480, screen: rightScreen)
        storage.saveState(state, for: "test")

        // Restore with both screens present
        let loaded = storage.loadState(for: "test")!
        let match = ScreenMatcher.findBestMatch(for: loaded.screenFingerprint, among: [leftScreen, rightScreen])
        XCTAssertEqual(match?.quality, .exact)
        XCTAssertEqual(match?.screen.frame, rightScreen.frame)

        let restored = FrameCalculator.absoluteFrame(
            proportionalX: loaded.proportionalX,
            proportionalY: loaded.proportionalY,
            width: loaded.width,
            height: loaded.height,
            screenVisibleFrame: rightScreen.visibleFrame,
            minSize: NSSize(width: 200, height: 200)
        )

        // Should be centered on the right screen (offset by 1920)
        XCTAssertEqual(restored.origin.x, 1920 + (2560 - 600) / 2, accuracy: 1)
    }

    // MARK: - Helper

    private func makeState(
        propX: CGFloat,
        propY: CGFloat,
        width: CGFloat,
        height: CGFloat,
        screen: MockScreen
    ) -> PersistedWindowState {
        PersistedWindowState(
            proportionalX: propX,
            proportionalY: propY,
            width: width,
            height: height,
            screenFingerprint: screen.fingerprint,
            savedAt: Date()
        )
    }
}

// MARK: - Mock Storage Tests

final class MockStorageTests: XCTestCase {

    func testSaveAndLoad() {
        let storage = MockStorage()
        let state = PersistedWindowState(
            proportionalX: 0.5, proportionalY: 0.5,
            width: 600, height: 480,
            screenFingerprint: ScreenFingerprint(
                displayUUID: "TEST", localizedName: "Test",
                resolutionWidth: 1920, resolutionHeight: 1080, isMain: true
            ),
            savedAt: Date()
        )
        storage.saveState(state, for: "window1")

        let loaded = storage.loadState(for: "window1")
        XCTAssertNotNil(loaded)
        XCTAssertEqual(loaded?.proportionalX, 0.5)
        XCTAssertEqual(loaded?.width, 600)
    }

    func testLoadNonexistentReturnsNil() {
        let storage = MockStorage()
        XCTAssertNil(storage.loadState(for: "nonexistent"))
    }

    func testRemoveState() {
        let storage = MockStorage()
        let state = PersistedWindowState(
            proportionalX: 0.5, proportionalY: 0.5,
            width: 600, height: 480,
            screenFingerprint: ScreenFingerprint(
                displayUUID: nil, localizedName: nil,
                resolutionWidth: 1920, resolutionHeight: 1080, isMain: true
            ),
            savedAt: Date()
        )
        storage.saveState(state, for: "window1")
        storage.removeState(for: "window1")
        XCTAssertNil(storage.loadState(for: "window1"))
    }
}

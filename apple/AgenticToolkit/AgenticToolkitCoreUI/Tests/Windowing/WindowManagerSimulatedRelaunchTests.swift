import XCTest
@testable import AgenticToolkitCoreUI

@MainActor
final class WindowManagerSimulatedRelaunchTests: XCTestCase {

    func testRestorationOnSameScreen() {
        let storage = MockStorage()
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "MAIN", name: "Built-in", isMain: true
        )

        let state = makeState(propX: 0.7, propY: 0.3, width: 600, height: 480, screen: screen)
        storage.saveState(state, for: "test")

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

        let state = makeState(propX: 1.0, propY: 0.0, width: 600, height: 480, screen: oldScreen)
        storage.saveState(state, for: "test")

        let loaded = storage.loadState(for: "test")!

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

        XCTAssertEqual(restored.origin.x, 1960, accuracy: 1)
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

        let state = makeState(propX: 0.9, propY: 0.9, width: 600, height: 480, screen: externalScreen)
        storage.saveState(state, for: "test")

        let loaded = storage.loadState(for: "test")!
        let match = ScreenMatcher.findBestMatch(for: loaded.screenFingerprint, among: [builtinScreen])
        XCTAssertNil(match, "External screen UUID should not match built-in")

        let fallbackScreen = builtinScreen
        let restored = FrameCalculator.absoluteFrame(
            proportionalX: loaded.proportionalX,
            proportionalY: loaded.proportionalY,
            width: loaded.width,
            height: loaded.height,
            screenVisibleFrame: fallbackScreen.visibleFrame,
            minSize: NSSize(width: 200, height: 200)
        )

        let expectedX = 0.9 * (1920 - 600)
        let expectedY = 0.9 * (1080 - 480)
        XCTAssertEqual(restored.origin.x, expectedX, accuracy: 1)
        XCTAssertEqual(restored.origin.y, expectedY, accuracy: 1)

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

        XCTAssertEqual(restored.width, 800)
        XCTAssertEqual(restored.height, 600)
    }

    func testRestorationWithMenuBarAndDock() {
        let storage = MockStorage()

        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            visibleFrame: NSRect(x: 0, y: 70, width: 1920, height: 985),
            uuid: "MAIN", name: "Built-in", isMain: true
        )

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

        XCTAssertEqual(restored.origin.x, (1920 - 600) / 2, accuracy: 1)
        let expectedY: CGFloat = 70 + (985 - 480) / 2
        XCTAssertEqual(restored.origin.y, expectedY, accuracy: 1)
        XCTAssertGreaterThanOrEqual(restored.origin.y, 70)
        XCTAssertLessThanOrEqual(restored.maxY, 70 + 985)
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

        let state = makeState(propX: 0.5, propY: 0.5, width: 600, height: 480, screen: rightScreen)
        storage.saveState(state, for: "test")

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

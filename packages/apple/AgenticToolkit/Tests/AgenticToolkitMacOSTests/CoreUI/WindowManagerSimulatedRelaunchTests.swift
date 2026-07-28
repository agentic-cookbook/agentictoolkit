import XCTest
@testable import AgenticToolkitMacOS

/// Save → relaunch → restore simulations for the per-screen-set, top-left
/// anchored frame persistence. A "relaunch" is a fresh `WindowFrameManager`
/// (+ `ScreenManager`) over the same storage; screens are mocked so every
/// scenario — same set, resolution change, docking at a new location — is
/// deterministic.
@MainActor
final class WindowManagerSimulatedRelaunchTests: XCTestCase {

    private static let spec = WindowSpec(
        defaultSize: NSSize(width: 600, height: 480),
        minSize: NSSize(width: 200, height: 200),
        defaultPosition: .center,
        persistsFrame: true
    )

    private static func builtin(
        width: CGFloat = 1920, height: CGFloat = 1080, main: Bool = true
    ) -> MockScreen {
        MockScreen(
            frame: NSRect(x: 0, y: 0, width: width, height: height),
            uuid: "BUILTIN", name: "Built-in", isMain: main
        )
    }

    private static func external(main: Bool = false) -> MockScreen {
        MockScreen(
            frame: NSRect(x: 1920, y: 0, width: 2560, height: 1440),
            uuid: "EXTERNAL", name: "LG Monitor", isMain: main
        )
    }

    /// One simulated app launch: a frame manager over shared storage.
    private func makeFrames(
        screens: [MockScreen],
        storage: MockStorage,
        setStorage: MockScreenSetStorage
    ) -> (WindowFrameManager, MockScreenProvider, ScreenManager) {
        let provider = MockScreenProvider(screens: screens)
        let screenManager = ScreenManager(screenProvider: provider, storage: setStorage)
        let frames = WindowFrameManager(
            screenProvider: provider, storage: storage, screenManager: screenManager
        )
        frames.register(id: "test", spec: Self.spec)
        return (frames, provider, screenManager)
    }

    private func makeWindow(frame: NSRect = NSRect(x: 10, y: 10, width: 300, height: 200)) -> NSWindow {
        NSWindow(contentRect: frame, styleMask: [.borderless], backing: .buffered, defer: true)
    }

    // MARK: - Same screen set: exact restore

    func testSameSetRestoreIsExactAfterRelaunch() {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()

        // Session 1: the user placed the window here.
        let (frames1, _, _) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)
        let window1 = makeWindow(frame: NSRect(x: 300, y: 400, width: 600, height: 300))
        frames1.saveFrame(for: window1, id: "test")

        // Session 2: same screens → the exact same frame, no proportional math.
        let (frames2, _, _) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)
        let window2 = makeWindow()
        XCTAssertTrue(frames2.restoreFrame(for: window2, id: "test"))
        XCTAssertEqual(window2.frame, NSRect(x: 300, y: 400, width: 600, height: 300))
    }

    // MARK: - The drift regression

    /// A content-hugging window re-fits itself (top-left fixed, height/width
    /// vary with content) on every show, and each re-fit persists. Across
    /// arbitrarily many relaunch + re-fit cycles the top-left corner must
    /// not move — this walked between launches under the proportional
    /// scheme (observed: a clamped proportionalY of 1.1).
    func testContentRefitCannotDriftTopLeftAcrossRelaunches() {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()
        let anchorTopLeft = CGPoint(x: 250, y: 800)   // minX, maxY in screen coords

        let (frames0, _, _) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)
        let window0 = makeWindow(frame: NSRect(x: 250, y: 500, width: 500, height: 300))
        frames0.saveFrame(for: window0, id: "test")

        for contentHeight: CGFloat in [260, 420, 340, 300, 555] {
            let (frames, _, _) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)
            let window = makeWindow()
            XCTAssertTrue(frames.restoreFrame(for: window, id: "test"))
            XCTAssertEqual(window.frame.minX, anchorTopLeft.x, accuracy: 0.5,
                "top-left x must never drift across relaunches")
            XCTAssertEqual(window.frame.maxY, anchorTopLeft.y, accuracy: 0.5,
                "top-left y must never drift across relaunches")

            // Content re-fit: grow down from the fixed top-left (what
            // `fitWindow(toContentSize:)` does), then persist like the
            // delegate would on the resulting resize event.
            window.setFrame(
                NSRect(x: anchorTopLeft.x, y: anchorTopLeft.y - contentHeight,
                       width: 500, height: contentHeight),
                display: false
            )
            frames.saveFrame(for: window, id: "test")
        }
    }

    // MARK: - Resolution change

    func testRestoreAfterResolutionChangeUsesRelativePosition() {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()

        // Saved flush against the top-right corner of a 1920×1080 screen.
        let (frames1, _, _) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)
        let window1 = makeWindow(frame: NSRect(x: 1320, y: 600, width: 600, height: 480))
        frames1.saveFrame(for: window1, id: "test")

        // Same display, higher resolution: the relative (1.0, 0.0) position
        // keeps it flush top-right instead of replaying a stale offset.
        let (frames2, _, _) = makeFrames(screens: [Self.builtin(width: 2560, height: 1440)],
            storage: storage, setStorage: setStorage
        )
        let window2 = makeWindow()
        XCTAssertTrue(frames2.restoreFrame(for: window2, id: "test"))
        XCTAssertEqual(window2.frame, NSRect(x: 1960, y: 960, width: 600, height: 480))
    }

    func testLiveResolutionChangeMovesWindowToRelativePosition() {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()

        let (frames, provider, screenManager) = makeFrames(
            screens: [Self.builtin()], storage: storage, setStorage: setStorage
        )
        let window = makeWindow(frame: NSRect(x: 1320, y: 600, width: 600, height: 480))
        window.identifier = NSUserInterfaceItemIdentifier("wm_test")
        frames.windowLister = { [window] }
        frames.saveFrame(for: window, id: "test")

        // The screen changes resolution under the running app.
        provider.screens = [Self.builtin(width: 2560, height: 1440)]
        provider.mainScreen = provider.screens[0]
        screenManager.processScreenChange()

        XCTAssertEqual(window.frame, NSRect(x: 1960, y: 960, width: 600, height: 480),
            "a live resolution change must re-place the window at its relative position")
    }

    // MARK: - Screen set changes

    func testUnknownScreenSetFallsBackToMainScreenAndSavesPlacement() {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()

        // Saved centered on the external display (its own screen set).
        let (frames1, _, screens1) = makeFrames(screens: [Self.external(main: true)],
            storage: storage, setStorage: setStorage
        )
        let window1 = makeWindow(frame: NSRect(x: 2900, y: 480, width: 600, height: 480))
        frames1.saveFrame(for: window1, id: "test")
        let externalSetID = screens1.currentSetID

        // Relaunch undocked: unknown set → relative (0.5, 0.5) on the main
        // screen, saved immediately under the new set.
        let (frames2, _, screens2) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)
        let window2 = makeWindow()
        XCTAssertTrue(frames2.restoreFrame(for: window2, id: "test"))
        XCTAssertEqual(window2.frame, NSRect(x: 660, y: 300, width: 600, height: 480))

        let saved = storage.loadState(for: "test")!
        XCTAssertNotNil(saved.placements[externalSetID], "the docked location's placement is preserved")
        XCTAssertNotNil(saved.placements[screens2.currentSetID], "the new location's placement is established")
    }

    func testEachScreenSetRemembersItsOwnPlacement() {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()
        let undockedFrame = NSRect(x: 100, y: 500, width: 600, height: 300)
        let dockedFrame = NSRect(x: 2000, y: 700, width: 600, height: 300)

        // Undocked: place the window.
        let (framesA, _, _) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)
        let windowA = makeWindow(frame: undockedFrame)
        framesA.saveFrame(for: windowA, id: "test")

        // Docked: place it somewhere else (on the external display).
        let (framesB, _, _) = makeFrames(screens: [Self.builtin(), Self.external()],
            storage: storage, setStorage: setStorage
        )
        let windowB = makeWindow(frame: dockedFrame)
        framesB.saveFrame(for: windowB, id: "test")

        // Back undocked → the undocked position, exactly.
        let (framesC, _, _) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)
        let windowC = makeWindow()
        XCTAssertTrue(framesC.restoreFrame(for: windowC, id: "test"))
        XCTAssertEqual(windowC.frame, undockedFrame)

        // Docked again → the docked position, exactly.
        let (framesD, _, _) = makeFrames(screens: [Self.builtin(), Self.external()],
            storage: storage, setStorage: setStorage
        )
        let windowD = makeWindow()
        XCTAssertTrue(framesD.restoreFrame(for: windowD, id: "test"))
        XCTAssertEqual(windowD.frame, dockedFrame)
    }

    /// After a resolution change on the same screen set, restore places the
    /// window by relative position (finding the match is non-exact) AND
    /// re-saves, so the placement's fingerprint tracks the new resolution and
    /// the next restore hits the exact fast path.
    func testNonExactRestoreReSavesPlacementWithNewResolution() {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()

        let (frames1, _, _) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)
        let window1 = makeWindow(frame: NSRect(x: 300, y: 500, width: 600, height: 300))
        frames1.saveFrame(for: window1, id: "test")
        let firstSavedAt = storage.loadState(for: "test")!.placements.values.first!.savedAt

        // Same UUID (same set id) at a higher resolution → non-exact match.
        let (frames2, _, _) = makeFrames(screens: [Self.builtin(width: 2560, height: 1440)],
            storage: storage, setStorage: setStorage
        )
        let window2 = makeWindow()
        XCTAssertTrue(frames2.restoreFrame(for: window2, id: "test"))

        let updated = storage.loadState(for: "test")!.placements.values.first!
        XCTAssertEqual(updated.screenFingerprint.resolutionWidth, 2560,
            "re-save must record the new resolution so next restore is exact")
        XCTAssertEqual(updated.screenFingerprint.resolutionHeight, 1440)
        XCTAssertGreaterThanOrEqual(updated.savedAt, firstSavedAt)
    }

    /// Re-docking at a KNOWN screen set whose screen came back at a different
    /// resolution (arriving as a screen-set change, not a resolution change)
    /// must re-place by the saved *relative* position — not replay the stale
    /// absolute offset sized for the old resolution. This is the quality gate
    /// the live screen-set-changed path previously skipped.
    func testRedockAtKnownSetWithChangedResolutionUsesRelativePosition() {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()
        let ext2560 = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 2560, height: 1440),
            uuid: "EXT", name: "Ext", isMain: true
        )
        let ext1920 = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "EXT", name: "Ext", isMain: true
        )

        let (frames, provider, screenManager) = makeFrames(
            screens: [ext2560], storage: storage, setStorage: setStorage
        )
        let window = makeWindow(frame: NSRect(x: 200, y: 900, width: 600, height: 480))
        window.identifier = NSUserInterfaceItemIdentifier("wm_test")
        frames.windowLister = { [window] }
        frames.saveFrame(for: window, id: "test")
        let extSetID = screenManager.currentSetID
        let placement = storage.loadState(for: "test")!.placements[extSetID]!

        // Undock to a differently-sized built-in only (screen-set change away
        // from EXT). Distinct size so the re-dock below must actively move the
        // window, rather than it already sitting at the right relative spot.
        let builtin = Self.builtin(width: 1440, height: 900)
        provider.screens = [builtin]
        provider.mainScreen = builtin
        screenManager.processScreenChange()

        // Re-dock: EXT returns as the only screen, but now at 1920x1080. Same
        // UUID → same set id, so this is a screen-set change back into EXT.
        provider.screens = [ext1920]
        provider.mainScreen = ext1920
        screenManager.processScreenChange()

        XCTAssertEqual(screenManager.currentSetID, extSetID, "same UUID → same set id")

        let expected = FrameCalculator.validateFrame(
            FrameCalculator.frame(
                relativePosition: CGPoint(x: placement.relativeX, y: placement.relativeY),
                size: NSSize(width: placement.width, height: placement.height),
                screenVisibleFrame: ext1920.visibleFrame,
                minSize: Self.spec.minSize
            ),
            screenVisibleFrame: ext1920.visibleFrame,
            minSize: Self.spec.minSize
        )
        // NSWindow pixel-aligns the frame, so compare with a 1pt tolerance.
        XCTAssertEqual(window.frame.origin.x, expected.origin.x, accuracy: 1,
            "must use relative position on the resized screen, not the stale absolute offset")
        XCTAssertEqual(window.frame.origin.y, expected.origin.y, accuracy: 1)
        XCTAssertEqual(window.frame.size, expected.size)
        // The stale absolute-offset replay (the bug) would have put the window
        // ~66pt to the right; prove we're not there.
        let staleAbsoluteX = ext1920.visibleFrame.minX + placement.topLeftX
        XCTAssertNotEqual(window.frame.origin.x, staleAbsoluteX, accuracy: 1)
    }

    /// A display change AppKit acts on *before* it notifies us must not file the
    /// resulting move under the outgoing arrangement's key.
    ///
    /// When a display drops out, AppKit pulls the windows that were on it back
    /// onto a surviving screen — and that `windowDidMove` reaches `saveFrame`
    /// before `didChangeScreenParameters` reaches `ScreenManager`. If the set id
    /// is still the old one at that moment, the docked arrangement's placement
    /// is overwritten with a position on a screen that arrangement doesn't even
    /// contain, and re-docking brings the window back on the wrong display.
    func testMoveDuringUndeliveredScreenChangeDoesNotClobberTheDockedPlacement() throws {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()
        let dockedFrame = NSRect(x: 2200, y: 300, width: 600, height: 480)

        // Docked: the window lives on the external display.
        let (frames, provider, screenManager) = makeFrames(
            screens: [Self.builtin(), Self.external()], storage: storage, setStorage: setStorage
        )
        let window = makeWindow(frame: dockedFrame)
        window.identifier = NSUserInterfaceItemIdentifier("wm_test")
        frames.windowLister = { [window] }
        frames.saveFrame(for: window, id: "test")
        let dockedSetID = screenManager.currentSetID

        // The external display drops out. AppKit has already updated the screen
        // list and yanked the window onto the built-in — but the notification
        // hasn't been delivered, so `processScreenChange()` has NOT run yet.
        provider.screens = [Self.builtin()]
        provider.mainScreen = provider.screens[0]
        window.setFrame(NSRect(x: 100, y: 300, width: 600, height: 480), display: false)
        frames.saveFrame(for: window, id: "test")

        let saved = try XCTUnwrap(storage.loadState(for: "test"))
        let soloSetID = ScreenSet.identity(of: [ScreenSnapshot(Self.builtin())])
        XCTAssertEqual(saved.placements[dockedSetID]?.screenFingerprint.displayUUID, "EXTERNAL",
            "the docked arrangement must still remember the external display")
        XCTAssertEqual(saved.placements[soloSetID]?.screenFingerprint.displayUUID, "BUILTIN",
            "the undocked move belongs to the undocked arrangement")

        // Re-dock and relaunch: the window comes back where the user left it.
        let (frames2, _, _) = makeFrames(
            screens: [Self.builtin(), Self.external()], storage: storage, setStorage: setStorage
        )
        let window2 = makeWindow()
        XCTAssertTrue(frames2.restoreFrame(for: window2, id: "test"))
        XCTAssertEqual(window2.frame, dockedFrame,
            "re-docking must restore onto the external display, not the built-in")
    }

    // MARK: - Oversize clamp

    /// A window saved LARGER than the screen it later restores onto must come
    /// back clamped to fit — the size guard survives the save → relaunch round
    /// trip under the per-screen-set model. (The proportional suite covered this
    /// end-to-end via `testRestorationWhenScreenShrinksMakesWindowTooLarge`,
    /// which the rewrite dropped.)
    func testOversizeSavedWindowIsClampedToShrunkenScreenOnRelaunch() {
        let storage = MockStorage()
        let setStorage = MockScreenSetStorage()

        // Session 1: a large window on a large display.
        let (frames1, _, _) = makeFrames(
            screens: [Self.builtin(width: 2560, height: 1440)],
            storage: storage, setStorage: setStorage
        )
        let window1 = makeWindow(frame: NSRect(x: 400, y: 300, width: 1200, height: 900))
        frames1.saveFrame(for: window1, id: "test")

        // Session 2: the SAME display returns much smaller (same UUID → same set
        // id, lower resolution). Restore must clamp the window to the new screen
        // instead of restoring a 1200×900 frame that overflows an 800×600 area.
        let small = Self.builtin(width: 800, height: 600)
        let (frames2, _, _) = makeFrames(screens: [small], storage: storage, setStorage: setStorage)
        let window2 = makeWindow()
        XCTAssertTrue(frames2.restoreFrame(for: window2, id: "test"))

        // Size clamped to the (shrunken) visible frame …
        XCTAssertEqual(window2.frame.width, small.visibleFrame.width, accuracy: 1,
            "an oversize saved width must clamp to the restored screen")
        XCTAssertEqual(window2.frame.height, small.visibleFrame.height, accuracy: 1,
            "an oversize saved height must clamp to the restored screen")
        // … and the whole window is on-screen (no edge hanging off).
        XCTAssertGreaterThanOrEqual(window2.frame.minX, small.visibleFrame.minX - 0.5)
        XCTAssertGreaterThanOrEqual(window2.frame.minY, small.visibleFrame.minY - 0.5)
        XCTAssertLessThanOrEqual(window2.frame.maxX, small.visibleFrame.maxX + 0.5)
        XCTAssertLessThanOrEqual(window2.frame.maxY, small.visibleFrame.maxY + 0.5)
    }

    // MARK: - v1 migration

    func testLegacyV1StateMigratesToPlacementOnRestore() throws {
        let v1JSON = """
        {
            "proportionalX": 0.7,
            "proportionalY": 0.3,
            "width": 600,
            "height": 480,
            "screenFingerprint": {
                "displayUUID": "BUILTIN",
                "localizedName": "Built-in",
                "resolutionWidth": 1920,
                "resolutionHeight": 1080,
                "isMain": true
            },
            "savedAt": 700000000
        }
        """
        let decoded = try JSONDecoder().decode(PersistedWindowState.self, from: Data(v1JSON.utf8))
        XCTAssertNotNil(decoded.legacy, "v1 blobs must decode via the legacy path")
        XCTAssertTrue(decoded.placements.isEmpty)

        let storage = MockStorage()
        storage.saveState(decoded, for: "test")
        let setStorage = MockScreenSetStorage()
        let (frames, _, screenManager) = makeFrames(screens: [Self.builtin()], storage: storage, setStorage: setStorage)

        let window = makeWindow()
        XCTAssertTrue(frames.restoreFrame(for: window, id: "test"))

        // The old proportional math applied once: x = 0.7·(1920−600),
        // y = 0.3·(1080−480). NSWindow may round to integral pixels.
        XCTAssertEqual(window.frame.origin.x, 924, accuracy: 1)
        XCTAssertEqual(window.frame.origin.y, 180, accuracy: 1)
        XCTAssertEqual(window.frame.size, NSSize(width: 600, height: 480))

        // …and the state is now a per-set placement (legacy consumed).
        let migrated = storage.loadState(for: "test")!
        XCTAssertNil(migrated.legacy)
        XCTAssertNotNil(migrated.placements[screenManager.currentSetID])
    }

    func testEmptyOrMalformedJSONDecodesToEmptyPlacementsInsteadOfThrowing() throws {
        for json in ["{}", "{\"placements\": null}", "{\"unrelated\": 1}"] {
            let decoded = try JSONDecoder().decode(PersistedWindowState.self, from: Data(json.utf8))
            XCTAssertTrue(decoded.placements.isEmpty, "\(json) should decode to empty placements")
            XCTAssertNil(decoded.legacy, "\(json) is not a legacy record")
        }
    }

    func testV2StateSurvivesJSONRoundTrip() throws {
        let placement = WindowPlacement(
            screenFingerprint: Self.builtin().fingerprint,
            topLeftX: 250, topLeftY: 80,
            width: 600, height: 480,
            relativeX: 0.2, relativeY: 0.1,
            savedAt: Date(timeIntervalSinceReferenceDate: 700000000)
        )
        let state = PersistedWindowState(placements: ["SET": placement])
        let data = try JSONEncoder().encode(state)
        let decoded = try JSONDecoder().decode(PersistedWindowState.self, from: data)
        XCTAssertNil(decoded.legacy)
        XCTAssertEqual(decoded.placements, ["SET": placement])
    }

    // MARK: - Restore registration

    func testRestoreOnLaunchBuildsEveryRegisteredRestorable() {
        let provider = MockScreenProvider(screens: [Self.builtin()])
        let windowManager = WindowManager(
            screenProvider: provider,
            storage: MockStorage(),
            screenManager: ScreenManager(screenProvider: provider, storage: MockScreenSetStorage())
        )

        var built: Set<String> = []
        windowManager.registerRestorable(id: "alpha") { built.insert("alpha") }
        windowManager.registerRestorable(id: "beta") { built.insert("beta") }

        windowManager.restoreOnLaunch()

        // Every registered factory runs so its controller is in the registry for the
        // visibility-restore pass — the host no longer hand-constructs each window.
        XCTAssertEqual(built, ["alpha", "beta"])
    }
}

// MARK: - Mock Storage Tests

@MainActor
final class MockStorageTests: XCTestCase {

    private func makeState() -> PersistedWindowState {
        PersistedWindowState(placements: [
            "SET": WindowPlacement(
                screenFingerprint: ScreenFingerprint(
                    displayUUID: "TEST", localizedName: "Test",
                    resolutionWidth: 1920, resolutionHeight: 1080, isMain: true
                ),
                topLeftX: 100, topLeftY: 40,
                width: 600, height: 480,
                relativeX: 0.5, relativeY: 0.5,
                savedAt: Date()
            )
        ])
    }

    func testSaveAndLoad() {
        let storage = MockStorage()
        storage.saveState(makeState(), for: "window1")

        let loaded = storage.loadState(for: "window1")
        XCTAssertNotNil(loaded)
        XCTAssertEqual(loaded?.placements["SET"]?.width, 600)
        XCTAssertEqual(loaded?.placements["SET"]?.topLeftX, 100)
    }

    func testLoadNonexistentReturnsNil() {
        let storage = MockStorage()
        XCTAssertNil(storage.loadState(for: "nonexistent"))
    }

    func testRemoveState() {
        let storage = MockStorage()
        storage.saveState(makeState(), for: "window1")
        storage.removeState(for: "window1")
        XCTAssertNil(storage.loadState(for: "window1"))
    }
}

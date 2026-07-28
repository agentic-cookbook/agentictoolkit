import XCTest
@testable import AgenticToolkitMacOS

@MainActor
final class ScreenManagerTests: XCTestCase {

    private static let builtin = MockScreen(
        frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
        uuid: "BUILTIN", name: "Built-in", isMain: true
    )
    private static let external = MockScreen(
        frame: NSRect(x: 1920, y: 0, width: 2560, height: 1440),
        uuid: "EXTERNAL", name: "LG Monitor", isMain: false
    )

    private func makeManager(
        screens: [MockScreen],
        storage: MockScreenSetStorage = MockScreenSetStorage(),
        maxSetAge: TimeInterval = 180 * 24 * 60 * 60,
        now: @escaping () -> Date = { Date() }
    ) -> (ScreenManager, MockScreenSetStorage, MockScreenProvider) {
        let provider = MockScreenProvider(screens: screens)
        let manager = ScreenManager(
            screenProvider: provider, storage: storage, maxSetAge: maxSetAge, now: now
        )
        return (manager, storage, provider)
    }

    // MARK: - Identity

    func testSetIdentityIsOrderIndependent() {
        let forward = [Self.builtin, Self.external].map { ScreenSnapshot($0) }
        let reversed = [Self.external, Self.builtin].map { ScreenSnapshot($0) }
        XCTAssertEqual(ScreenSet.identity(of: forward), ScreenSet.identity(of: reversed))
    }

    func testSetIdentitySurvivesResolutionAndArrangementChanges() {
        let before = ScreenSet.identity(of: [ScreenSnapshot(Self.builtin)])
        let resized = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 2560, height: 1440),
            uuid: "BUILTIN", name: "Built-in", isMain: true
        )
        XCTAssertEqual(before, ScreenSet.identity(of: [ScreenSnapshot(resized)]))
    }

    func testDifferentMembershipMeansDifferentIdentity() {
        let solo = ScreenSet.identity(of: [ScreenSnapshot(Self.builtin)])
        let docked = ScreenSet.identity(of: [Self.builtin, Self.external].map { ScreenSnapshot($0) })
        XCTAssertNotEqual(solo, docked)
    }

    // MARK: - Persistence + timestamps

    func testInitRecordsAndPersistsCurrentSet() throws {
        let start = Date(timeIntervalSince1970: 1_000_000)
        let (manager, storage, _) = makeManager(screens: [Self.builtin], now: { start })

        XCTAssertEqual(manager.knownSets.count, 1)
        let set = try XCTUnwrap(manager.currentSet)
        XCTAssertEqual(set.id, manager.currentSetID)
        XCTAssertEqual(set.firstSeen, start)
        XCTAssertEqual(set.lastSeen, start)
        XCTAssertEqual(set.screens.count, 1)
        XCTAssertEqual(set.screens[0].displayUUID, "BUILTIN")
        XCTAssertEqual(storage.sets.map(\.id), [set.id])
    }

    func testTouchCurrentSetBumpsLastSeenButKeepsFirstSeen() throws {
        var clock = Date(timeIntervalSince1970: 1_000_000)
        let (manager, _, _) = makeManager(screens: [Self.builtin], now: { clock })

        clock = clock.addingTimeInterval(3600)
        manager.touchCurrentSet()

        let set = try XCTUnwrap(manager.currentSet)
        XCTAssertEqual(set.firstSeen, Date(timeIntervalSince1970: 1_000_000))
        XCTAssertEqual(set.lastSeen, clock)
    }

    func testSetsNotSeenForSixMonthsAgeOutOnLoad() {
        let now = Date(timeIntervalSince1970: 100_000_000)
        let storage = MockScreenSetStorage()
        storage.sets = [
            ScreenSet(
                id: "STALE",
                screens: [],
                firstSeen: now.addingTimeInterval(-400 * 24 * 3600),
                lastSeen: now.addingTimeInterval(-200 * 24 * 3600)
            ),
            ScreenSet(
                id: "FRESH",
                screens: [],
                firstSeen: now.addingTimeInterval(-10 * 24 * 3600),
                lastSeen: now.addingTimeInterval(-1 * 24 * 3600)
            )
        ]

        let (manager, _, _) = makeManager(screens: [Self.builtin], storage: storage, now: { now })

        XCTAssertFalse(manager.knownSetIDs.contains("STALE"), "sets unseen for >6 months must age out")
        XCTAssertTrue(manager.knownSetIDs.contains("FRESH"))
        XCTAssertTrue(manager.knownSetIDs.contains(manager.currentSetID))
    }

    // MARK: - Change classification

    func testClassifyNilForIdenticalSnapshots() {
        let snapshots = [Self.builtin, Self.external].map { ScreenSnapshot($0) }
        XCTAssertNil(ScreenManager.classifyChange(from: snapshots, to: snapshots))
    }

    func testClassifyResolutionChange() {
        let before = [ScreenSnapshot(Self.builtin)]
        let after = [ScreenSnapshot(MockScreen(
            frame: NSRect(x: 0, y: 0, width: 2560, height: 1440),
            uuid: "BUILTIN", name: "Built-in", isMain: true
        ))]
        XCTAssertEqual(ScreenManager.classifyChange(from: before, to: after), .resolutionChanged)
    }

    func testClassifyArrangementChange() {
        let before = [Self.builtin, Self.external].map { ScreenSnapshot($0) }
        let movedExternal = MockScreen(
            frame: NSRect(x: -2560, y: 0, width: 2560, height: 1440),
            uuid: "EXTERNAL", name: "LG Monitor", isMain: false
        )
        let after = [Self.builtin, movedExternal].map { ScreenSnapshot($0) }
        XCTAssertEqual(ScreenManager.classifyChange(from: before, to: after), .arrangementChanged)
    }

    func testClassifyScreenSetChange() {
        let before = [ScreenSnapshot(Self.builtin)]
        let after = [Self.builtin, Self.external].map { ScreenSnapshot($0) }
        let change = ScreenManager.classifyChange(from: before, to: after)
        XCTAssertEqual(change, .screenSetChanged(
            previousSetID: ScreenSet.identity(of: before),
            currentSetID: ScreenSet.identity(of: after)
        ))
    }

    /// A pure resolution change on a UUID-less display must classify as a
    /// resolution change — not a screen-set change. Set identity is
    /// resolution-independent (name only for UUID-less screens), so the set id
    /// is unchanged and the geometry diff reaches `.resolutionChanged`.
    func testUUIDLessScreenResolutionChangeIsResolutionChange() {
        let before = [ScreenSnapshot(MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: nil, name: "Dock HDMI", isMain: true
        ))]
        let after = [ScreenSnapshot(MockScreen(
            frame: NSRect(x: 0, y: 0, width: 2560, height: 1440),
            uuid: nil, name: "Dock HDMI", isMain: true
        ))]
        XCTAssertEqual(ScreenSet.identity(of: before), ScreenSet.identity(of: after),
            "a UUID-less screen's set identity must not depend on resolution")
        XCTAssertEqual(ScreenManager.classifyChange(from: before, to: after), .resolutionChanged)
    }

    /// Two indistinguishable UUID-less monitors (same name + resolution) must
    /// not confuse classification. Multiset geometry comparison sidesteps the
    /// identity-key mispairing that previously reported spurious changes.
    func testDuplicateIdenticalScreensUnchangedClassifiesNil() {
        let first = MockScreen(frame: NSRect(x: 0, y: 0, width: 1920, height: 1080), uuid: nil, name: "Twin")
        let second = MockScreen(frame: NSRect(x: 1920, y: 0, width: 1920, height: 1080), uuid: nil, name: "Twin")
        let snapshots = [first, second].map { ScreenSnapshot($0) }
        XCTAssertNil(ScreenManager.classifyChange(from: snapshots, to: snapshots),
            "identical unchanged duplicates must not report a spurious change")
    }

    func testDuplicateIdenticalScreensOneMovesClassifiesArrangement() {
        let first = MockScreen(frame: NSRect(x: 0, y: 0, width: 1920, height: 1080), uuid: nil, name: "Twin")
        let second = MockScreen(frame: NSRect(x: 1920, y: 0, width: 1920, height: 1080), uuid: nil, name: "Twin")
        let before = [first, second].map { ScreenSnapshot($0) }
        let secondMoved = MockScreen(frame: NSRect(x: 3840, y: 0, width: 1920, height: 1080), uuid: nil, name: "Twin")
        let after = [first, secondMoved].map { ScreenSnapshot($0) }
        XCTAssertEqual(ScreenManager.classifyChange(from: before, to: after), .arrangementChanged)
    }

    // MARK: - Live change processing

    func testProcessScreenChangeUpdatesSetAndNotifiesObserver() {
        let (manager, storage, provider) = makeManager(screens: [Self.builtin])
        let soloSetID = manager.currentSetID

        var received: [ScreenChange] = []
        var setIDWhenNotified: String?
        manager.addObserver { change in
            received.append(change)
            setIDWhenNotified = manager.currentSetID
        }

        provider.screens = [Self.builtin, Self.external]
        manager.processScreenChange()

        let dockedSetID = manager.currentSetID
        XCTAssertNotEqual(dockedSetID, soloSetID)
        XCTAssertEqual(received, [.screenSetChanged(previousSetID: soloSetID, currentSetID: dockedSetID)])
        XCTAssertEqual(setIDWhenNotified, dockedSetID,
            "observers must run after currentSetID is updated")
        XCTAssertEqual(Set(storage.sets.map(\.id)), [soloSetID, dockedSetID],
            "both locations stay known")
        XCTAssertEqual(manager.knownSets.first?.id, dockedSetID, "most recently seen first")
    }

    func testSpuriousNotificationDoesNotNotify() {
        let (manager, _, _) = makeManager(screens: [Self.builtin])
        var notified = false
        manager.addObserver { _ in notified = true }
        manager.processScreenChange()
        XCTAssertFalse(notified)
    }

    func testRemoveObserverStopsDelivery() {
        let (manager, _, provider) = makeManager(screens: [Self.builtin])
        var notified = false
        let token = manager.addObserver { _ in notified = true }
        manager.removeObserver(token)
        provider.screens = [Self.builtin, Self.external]
        manager.processScreenChange()
        XCTAssertFalse(notified)
    }

    // MARK: - Reconciling with live screens between notifications

    /// AppKit repositions windows during a display reconfiguration, so
    /// `saveFrame` (→ `touchCurrentSet`) can run before the screen-parameters
    /// notification is delivered. The set id must already reflect the live
    /// screens by then, or the placement is filed under the previous
    /// arrangement's key.
    func testTouchCurrentSetPicksUpAnUndeliveredScreenChange() {
        let (manager, storage, provider) = makeManager(screens: [Self.builtin])
        let soloSetID = manager.currentSetID

        // The external display arrives; no notification has been processed yet.
        provider.screens = [Self.builtin, Self.external]
        manager.touchCurrentSet()

        let dockedSetID = ScreenSet.identity(of: [Self.builtin, Self.external].map { ScreenSnapshot($0) })
        XCTAssertEqual(manager.currentSetID, dockedSetID,
            "touchCurrentSet must settle the id against the live screens")
        XCTAssertNotEqual(manager.currentSetID, soloSetID)
        XCTAssertTrue(storage.sets.contains { $0.id == dockedSetID },
            "the newly-live set is recorded, not just held in memory")
    }

    /// The reconcile above must not swallow the notification that follows it:
    /// classification runs off the last snapshots we actually notified on, so
    /// `WindowFrameManager` still gets its reposition event.
    func testReconcileDoesNotSwallowTheFollowingChangeNotification() {
        let (manager, _, provider) = makeManager(screens: [Self.builtin])
        let soloSetID = manager.currentSetID

        var received: [ScreenChange] = []
        manager.addObserver { received.append($0) }

        provider.screens = [Self.builtin, Self.external]
        manager.touchCurrentSet()
        XCTAssertTrue(received.isEmpty, "the reconcile itself must not notify — it can re-enter saveFrame")

        // The real notification lands a moment later.
        manager.processScreenChange()

        XCTAssertEqual(received, [.screenSetChanged(
            previousSetID: soloSetID, currentSetID: manager.currentSetID
        )], "the change is still classified against the pre-reconcile baseline")
    }

    /// The hot path (`touchCurrentSet` on every drag tick) must not thrash when
    /// nothing moved: an unchanged frame list short-circuits before snapshots
    /// are rebuilt, and the id is unchanged either way.
    func testTouchCurrentSetIsStableWhenScreensAreUnchanged() {
        let (manager, _, _) = makeManager(screens: [Self.builtin, Self.external])
        let setID = manager.currentSetID
        for _ in 0..<5 { manager.touchCurrentSet() }
        XCTAssertEqual(manager.currentSetID, setID)
        XCTAssertEqual(manager.knownSets.filter { $0.id == setID }.count, 1)
    }

    func testReturningToKnownSetKeepsFirstSeen() throws {
        var clock = Date(timeIntervalSince1970: 1_000_000)
        let (manager, _, provider) = makeManager(screens: [Self.builtin], now: { clock })
        let soloSetID = manager.currentSetID

        clock = clock.addingTimeInterval(3600)
        provider.screens = [Self.builtin, Self.external]
        manager.processScreenChange()

        clock = clock.addingTimeInterval(3600)
        provider.screens = [Self.builtin]
        manager.processScreenChange()

        XCTAssertEqual(manager.currentSetID, soloSetID)
        let set = try XCTUnwrap(manager.currentSet)
        XCTAssertEqual(set.firstSeen, Date(timeIntervalSince1970: 1_000_000))
        XCTAssertEqual(set.lastSeen, clock)
    }
}

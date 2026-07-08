import AppKit
import os
import AgenticToolkitCore

/// Owns everything screen-related: the current screen set, the persisted
/// list of every screen set the machine has been attached to (with
/// first/last-seen timestamps), and classification of live screen changes.
///
/// A "screen set" is the group of displays connected at one location; a
/// laptop that travels between home and office produces one set per desk.
/// `WindowFrameManager` keys window placements by `currentSetID` so each
/// window remembers a position per location.
///
/// Listens for `NSApplication.didChangeScreenParametersNotification`,
/// classifies the change (`ScreenChange`), updates + persists the set list,
/// and notifies observers. Sets not seen for `maxSetAge` (default six
/// months) are aged out on load and on every update.
@MainActor
public final class ScreenManager {

    public static let shared = ScreenManager()

    public let screenProvider: ScreenProvider
    public let storage: ScreenSetStorage
    /// Sets whose `lastSeen` is older than this are dropped. Default 180 days.
    public let maxSetAge: TimeInterval

    /// Every known screen set, most recently seen first. Persisted.
    public private(set) var knownSets: [ScreenSet] = []
    /// Identity of the set of screens attached right now.
    public private(set) var currentSetID: String
    /// Latest per-screen snapshots, kept to diff against on change events.
    private var currentSnapshots: [ScreenSnapshot]

    private var observers: [UUID: @MainActor (ScreenChange) -> Void] = [:]
    /// Injected clock so tests can control `savedAt`/aging.
    let now: () -> Date
    /// Throttles persistence from high-frequency touch callers (a window
    /// drag fires `saveFrame` — and thus `touchCurrentSet` — every tick).
    private var lastPersistedTouch: Date?
    private static let touchPersistInterval: TimeInterval = 60

    public init(
        screenProvider: ScreenProvider = RealScreenProvider(),
        storage: ScreenSetStorage = SettingsStoreScreenSetStorage(settings: UserSettings.shared),
        maxSetAge: TimeInterval = 180 * 24 * 60 * 60,
        now: @escaping () -> Date = { Date() }
    ) {
        self.screenProvider = screenProvider
        self.storage = storage
        self.maxSetAge = maxSetAge
        self.now = now

        let snapshots = screenProvider.screens.map(ScreenSnapshot.init)
        self.currentSnapshots = snapshots
        self.currentSetID = ScreenSet.identity(of: snapshots)
        self.knownSets = Self.pruned(storage.loadSets(), olderThan: maxSetAge, now: now())
        upsertCurrentSet(persist: true)
        startObservingScreenChanges()
    }

    /// The persisted record for the screens attached right now.
    public var currentSet: ScreenSet? {
        knownSets.first { $0.id == currentSetID }
    }

    public var knownSetIDs: Set<String> {
        Set(knownSets.map(\.id))
    }

    // MARK: - Observers

    /// Registers a screen-change handler; fires after `currentSetID` and the
    /// persisted set list have been updated. Returns a token for removal.
    @discardableResult
    public func addObserver(_ handler: @escaping @MainActor (ScreenChange) -> Void) -> UUID {
        let token = UUID()
        observers[token] = handler
        return token
    }

    public func removeObserver(_ token: UUID) {
        observers[token] = nil
    }

    // MARK: - Change handling

    /// Starts observing screen change notifications. Called automatically by
    /// `init`; idempotent (`addObserver` replaces the previous registration
    /// for the same selector/name pair), so hosts may re-arm safely.
    public func startObservingScreenChanges() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screensDidChangeNotification),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    @objc private func screensDidChangeNotification() {
        processScreenChange()
    }

    /// Diffs the live screens against the last snapshot; on a real change,
    /// updates the current set, persists, and notifies observers. Internal
    /// (not private) so tests can drive it without posting notifications.
    func processScreenChange() {
        let snapshots = screenProvider.screens.map(ScreenSnapshot.init)
        let change = Self.classifyChange(from: currentSnapshots, to: snapshots)
        currentSnapshots = snapshots
        currentSetID = ScreenSet.identity(of: snapshots)
        guard let change else { return }
        upsertCurrentSet(persist: true)
        let description = String(describing: change)
        logger.info("ScreenManager: \(description, privacy: .public) → set '\(self.currentSetID, privacy: .public)'")
        for handler in observers.values {
            handler(change)
        }
    }

    /// Classifies what changed between two snapshot lists. Returns nil for a
    /// spurious notification (nothing actually moved).
    static func classifyChange(
        from old: [ScreenSnapshot],
        to new: [ScreenSnapshot]
    ) -> ScreenChange? {
        let oldID = ScreenSet.identity(of: old)
        let newID = ScreenSet.identity(of: new)
        guard oldID == newID else {
            return .screenSetChanged(previousSetID: oldID, currentSetID: newID)
        }

        // Same membership: pair screens up by identity and compare geometry.
        let oldByIdentity = Dictionary(old.map { ($0.identityComponent, $0) }, uniquingKeysWith: { first, _ in first })
        var resized = false
        var moved = false
        for screen in new {
            guard let previous = oldByIdentity[screen.identityComponent] else { continue }
            if previous.frame.size != screen.frame.size
                || previous.visibleFrame.size != screen.visibleFrame.size {
                resized = true
            }
            if previous.frame.origin != screen.frame.origin
                || previous.visibleFrame.origin != screen.visibleFrame.origin {
                moved = true
            }
        }
        if resized { return .resolutionChanged }
        if moved { return .arrangementChanged }
        return nil
    }

    // MARK: - Set bookkeeping

    /// Refreshes the current set's `lastSeen` (and snapshots) — called from
    /// window save/restore paths so a set stays alive while it's in use.
    /// Persistence is throttled; the in-memory record updates every call.
    public func touchCurrentSet() {
        let timestamp = now()
        let shouldPersist: Bool
        if let last = lastPersistedTouch, timestamp.timeIntervalSince(last) < Self.touchPersistInterval {
            shouldPersist = false
        } else {
            shouldPersist = true
            lastPersistedTouch = timestamp
        }
        upsertCurrentSet(persist: shouldPersist)
    }

    /// Inserts or updates the current set in `knownSets` (bumping `lastSeen`
    /// and refreshing snapshots), prunes aged-out sets, and optionally
    /// persists the list.
    private func upsertCurrentSet(persist: Bool) {
        let timestamp = now()
        if let index = knownSets.firstIndex(where: { $0.id == currentSetID }) {
            knownSets[index].screens = currentSnapshots
            knownSets[index].lastSeen = timestamp
        } else {
            knownSets.append(ScreenSet(
                id: currentSetID,
                screens: currentSnapshots,
                firstSeen: timestamp,
                lastSeen: timestamp
            ))
        }
        knownSets = Self.pruned(knownSets, olderThan: maxSetAge, now: timestamp)
        knownSets.sort { $0.lastSeen > $1.lastSeen }
        if persist {
            storage.saveSets(knownSets)
        }
    }

    private static func pruned(_ sets: [ScreenSet], olderThan maxAge: TimeInterval, now: Date) -> [ScreenSet] {
        sets.filter { now.timeIntervalSince($0.lastSeen) <= maxAge }
    }
}

extension ScreenManager: Loggable {
    public static nonisolated let logger = makeLogger()
}

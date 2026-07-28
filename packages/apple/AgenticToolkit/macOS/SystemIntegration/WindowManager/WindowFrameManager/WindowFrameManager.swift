import AppKit
import os
import AgenticToolkitCore

/// Centralized window frame persistence, keyed by screen set.
///
/// Positions are anchored at the window's **top-left** corner (user's point
/// of view) and stored per screen set (`ScreenManager.currentSetID`), so a
/// laptop that travels between docking locations restores each window to
/// the exact spot it occupied at that location. Restoring within the same
/// screen set replays the saved absolute top-left offset — content-driven
/// resizes therefore can't drift the window between launches. The saved
/// relative position (fraction of available travel) is used only when the
/// literal geometry no longer applies: a resolution change, or an unknown
/// screen set (fall back to the main screen).
///
/// Usage:
///   1. Register window specs at app startup via `register(id:spec:)`.
///   2. After creating a window, call `restoreFrame(for:id:)`.
///   3. On move/resize, call `saveFrame(for:id:)` (SingleWindowController
///      does this from its delegate hooks).
///
/// Owned by `WindowManager`; accessed via `WindowManager.shared.frames`.
@MainActor
public final class WindowFrameManager {

    public let screenProvider: ScreenProvider
    public let storage: WindowStateStorage
    /// Screen-set bookkeeping + change classification. Placements are keyed
    /// by its `currentSetID`.
    public let screenManager: ScreenManager

    fileprivate var windowSpecs: [String: WindowSpec] = [:]

    /// In-memory write-through cache of each window's persisted state, keyed by
    /// window id. Populated on restore/save so `saveFrame` — which fires on
    /// every move/resize tick — can mutate the placements dict without a
    /// UserDefaults read + JSON decode each time. Safe because this process is
    /// the sole writer of a given id's state.
    private var stateCache: [String: PersistedWindowState] = [:]

    /// Source of live windows for screen-change repositioning. Injectable so
    /// tests can supply windows without relying on `NSApp` enumeration.
    var windowLister: @MainActor () -> [NSWindow] = { NSApp?.windows ?? [] }

    public init(
        screenProvider: ScreenProvider = RealScreenProvider(),
        storage: WindowStateStorage = UserDefaultsWindowStateStorage(),
        screenManager: ScreenManager
    ) {
        self.screenProvider = screenProvider
        self.storage = storage
        self.screenManager = screenManager
        self.screenManager.addObserver { [weak self] change in
            self?.handleScreenChange(change)
        }
    }

    /// Reads a window's persisted state, preferring the in-memory cache to
    /// avoid a repeated UserDefaults fetch + JSON decode on hot paths.
    private func cachedState(for id: String) -> PersistedWindowState? {
        if let cached = stateCache[id] { return cached }
        let loaded = storage.loadState(for: id)
        stateCache[id] = loaded
        return loaded
    }

    /// Re-arms screen-change observation (delegated to `ScreenManager`,
    /// which observes `NSApplication.didChangeScreenParametersNotification`).
    /// Armed automatically at init; idempotent.
    public func startObservingScreenChanges() {
        screenManager.startObservingScreenChanges()
    }

    // MARK: - Registration

    /// Registers a window spec. Call once per window identifier at app startup.
    public func register(id: String, spec: WindowSpec) {
        windowSpecs[id] = spec
    }

    // MARK: - Frame Restoration

    /// Restores a window's frame from the saved placement for the current
    /// screen set, or applies defaults. Tags the window with an identifier
    /// so screen-change events can find it.
    @discardableResult
    public func restoreFrame(for window: NSWindow, id: String) -> Bool {
        window.identifier = NSUserInterfaceItemIdentifier("wm_\(id)")

        guard let spec = windowSpecs[id] else {
            logger.warning("WindowFrameManager: no spec for '\(id, privacy: .public)'")
            applyGeometricCenter(to: window)
            return false
        }

        window.minSize = spec.minSize

        guard spec.persistsFrame, let saved = cachedState(for: id) else {
            applyDefaultPosition(to: window, spec: spec)
            return false
        }

        // Restoring counts as "seeing" the current screen set — and settles the
        // set id against the live screens before we look a placement up under
        // it (same reason as `saveFrame`).
        screenManager.touchCurrentSet()
        let setID = screenManager.currentSetID

        let screens = screenProvider.screens
        guard !screens.isEmpty else {
            applyGeometricCenter(to: window)
            return false
        }

        // 1. Placement saved for this exact screen set. `resolvedFrame` picks
        //    the anchor by match quality: an exact screen match replays the
        //    literal top-left offset; a resolution/identity change uses the
        //    saved relative position instead.
        if let placement = saved.placements[setID] {
            let resolved = resolvedFrame(for: placement, spec: spec, among: screens)
            window.setFrame(resolved.frame, display: true)
            // Non-exact means the screen changed since the save, so we
            // restored via relative position and the stored offset/size/
            // fingerprint are stale — re-save so the placement tracks the new
            // resolution and future restores hit the exact fast path. The
            // delegate isn't wired during `loadWindow`, so this explicit save
            // is required (nothing else fires it here).
            if !resolved.isExact { saveFrame(for: window, id: id) }
            logger.debug("WindowFrameManager: restored '\(id, privacy: .public)' exact=\(resolved.isExact)")
            return true
        }

        // 2. Unknown screen set for this window → most recent placement's
        //    relative position on the main screen, then save it under the
        //    new set so the position is established immediately.
        if let resolved = relativeFallbackFrame(from: saved.placements, spec: spec, among: screens) {
            window.setFrame(resolved.frame, display: true)
            saveFrame(for: window, id: id)
            logger.debug("WindowFrameManager: placed '\(id, privacy: .public)' in new set '\(setID, privacy: .public)'")
            return true
        }

        // 3. v1 state → restore the old proportional way once, then re-save
        //    as a per-set placement (migration).
        if let legacy = saved.legacy {
            let match = ScreenMatcher.findBestMatch(for: legacy.screenFingerprint, among: screens)
            let screen = match?.screen ?? screenProvider.mainScreen ?? screens[0]
            let frame = FrameCalculator.absoluteFrame(
                proportionalX: legacy.proportionalX,
                proportionalY: legacy.proportionalY,
                width: legacy.width,
                height: legacy.height,
                screenVisibleFrame: screen.visibleFrame,
                minSize: spec.minSize
            )
            let validated = FrameCalculator.validateFrame(
                frame, screenVisibleFrame: screen.visibleFrame, minSize: spec.minSize
            )
            window.setFrame(validated, display: true)
            saveFrame(for: window, id: id)
            logger.debug("WindowFrameManager: migrated legacy state for '\(id, privacy: .public)'")
            return true
        }

        applyDefaultPosition(to: window, spec: spec)
        return false
    }

    // MARK: - Frame Saving

    /// Saves the window's current frame as the placement for the current
    /// screen set: absolute top-left offset + size, plus the relative
    /// (travel-fraction) position used for geometry-change fallbacks.
    /// Placements for other screen sets are preserved; placements for sets
    /// that have aged out of `ScreenManager` are pruned.
    public func saveFrame(for window: NSWindow, id: String) {
        guard let spec = windowSpecs[id], spec.persistsFrame else { return }

        // Settle the set id against the live screens *before* choosing the
        // screen to fingerprint, so the placement and the key it's filed under
        // come from one view of the world. AppKit repositions windows during a
        // display reconfiguration, and the resulting `windowDidMove` can land
        // here before the screen-change notification does.
        screenManager.touchCurrentSet()
        let setID = screenManager.currentSetID

        let screens = screenProvider.screens
        guard let screen = Self.bestScreen(for: window, among: screens) else { return }
        let visible = screen.visibleFrame
        let topLeft = FrameCalculator.topLeftOffset(
            windowFrame: window.frame, screenVisibleFrame: visible
        )
        let relative = FrameCalculator.relativePosition(
            windowFrame: window.frame, screenVisibleFrame: visible
        )

        // Rebuild from the cached (or loaded) placements — not the struct — so
        // a decoded legacy record is consumed by the first save, and the
        // per-tick UserDefaults read + JSON decode is avoided on the hot path.
        let existing = stateCache[id] ?? storage.loadState(for: id)
        var state = PersistedWindowState(placements: existing?.placements ?? [:])
        state.placements[setID] = WindowPlacement(
            screenFingerprint: screen.fingerprint,
            topLeftX: topLeft.x,
            topLeftY: topLeft.y,
            width: window.frame.width,
            height: window.frame.height,
            relativeX: relative.x,
            relativeY: relative.y,
            savedAt: screenManager.now()
        )
        // Age out placements the same way ScreenManager ages out sets: a
        // placement survives while its set is still known OR it was saved
        // recently (so a rebuilt set list can't wipe other locations' state).
        let liveSets = screenManager.knownSetIDs
        let cutoff = screenManager.now().addingTimeInterval(-screenManager.maxSetAge)
        state.placements = state.placements.filter { key, placement in
            key == setID || liveSets.contains(key) || placement.savedAt > cutoff
        }

        stateCache[id] = state
        storage.saveState(state, for: id)
    }

    // MARK: - Reset

    /// Clears saved state for a window and applies its default position.
    public func resetFrame(for window: NSWindow, id: String) {
        storage.removeState(for: id)
        stateCache[id] = nil
        if let spec = windowSpecs[id] {
            applyDefaultPosition(to: window, spec: spec)
        } else {
            applyGeometricCenter(to: window)
        }
    }

    /// Clears all saved window states.
    public func resetAllFrames() {
        for id in windowSpecs.keys {
            storage.removeState(for: id)
        }
        stateCache.removeAll()
    }

    /// Clears saved state for a single window.
    public func clearSavedState(for id: String) {
        storage.removeState(for: id)
        stateCache[id] = nil
    }

    // MARK: - Visibility persistence

    /// Returns the last persisted visibility (nil if never saved). Returns
    /// nil when the window's spec doesn't opt in to visibility persistence,
    /// so callers can short-circuit without consulting the spec themselves.
    public func loadVisibility(for id: String) -> Bool? {
        guard let spec = windowSpecs[id], spec.persistsVisibility else { return nil }
        return storage.loadVisibility(for: id)
    }

    /// IDs of every window saved as visible (across launches). Used by
    /// `WindowManager.restoreOnLaunch()` to flag a window that was visible but
    /// isn't registered for restore.
    public func visibleWindowIDs() -> [String] {
        storage.visibleWindowIDs()
    }

    /// Persists the window's current visible/hidden state. No-op when the
    /// window's spec doesn't opt in.
    public func saveVisibility(_ visible: Bool, for id: String) {
        guard let spec = windowSpecs[id], spec.persistsVisibility else { return }
        storage.saveVisibility(visible, for: id)
    }

    /// Clears persisted visibility for a single window.
    public func clearVisibility(for id: String) {
        storage.removeVisibility(for: id)
    }

    // MARK: - Default Position

    private func applyDefaultPosition(to window: NSWindow, spec: WindowSpec) {
        guard let screen = screenProvider.mainScreen ?? screenProvider.screens.first else {
            applyGeometricCenter(to: window)
            return
        }
        let frame = FrameCalculator.defaultFrame(spec: spec, screenVisibleFrame: screen.visibleFrame)
        window.setFrame(frame, display: true)
    }

    /// Positions the window at the geometric center of the main screen's
    /// visible frame. `NSWindow.center()` is NOT geometric center — it
    /// places the window one-third from the top.
    private func applyGeometricCenter(to window: NSWindow) {
        let screen = screenProvider.mainScreen ?? screenProvider.screens.first
        guard let visible = screen?.visibleFrame else {
            window.center()
            return
        }
        let origin = NSPoint(
            x: visible.origin.x + (visible.width - window.frame.width) / 2,
            y: visible.origin.y + (visible.height - window.frame.height) / 2
        )
        window.setFrameOrigin(origin)
    }

    // MARK: - Screen Change Handling

    /// Repositions managed windows after a screen change, per the change
    /// kind. Runs after `ScreenManager` has updated `currentSetID` and the
    /// persisted set list. Each `setFrame` here fires the controller's
    /// delegate hooks, which re-save the placement — so the stored state
    /// tracks the new geometry immediately.
    private func handleScreenChange(_ change: ScreenChange) {
        let screens = screenProvider.screens
        guard !screens.isEmpty else { return }
        let setID = screenManager.currentSetID
        // Snapshot the live windows once (keyed by id), not once per spec.
        let windowsByID = managedWindowsByID()

        for (id, spec) in windowSpecs {
            // Include non-visible (loaded but hidden) windows: their frame
            // was restored under the old geometry, and re-showing them would
            // otherwise use a stale position.
            guard let window = windowsByID[id] else { continue }
            // One decode per window (cached), reused for both the current-set
            // lookup and the unknown-set fallback below.
            let state = spec.persistsFrame ? cachedState(for: id) : nil

            if let placement = state?.placements[setID] {
                // Known placement for the current set. `resolvedFrame` applies
                // the right anchor by match quality: exact → replay the
                // absolute offset (arrangement move, or same-resolution
                // re-dock); resolution/identity change → relative position.
                // This single path covers resolutionChanged, arrangementChanged,
                // and a re-dock at an already-known set — including the case
                // (previously mishandled) where a known set's screen came back
                // at a new resolution.
                let resolved = resolvedFrame(for: placement, spec: spec, among: screens)
                apply(resolved.frame, to: window, on: resolved.screen, spec: spec, id: id)
            } else if case .screenSetChanged = change,
                      let state,
                      let resolved = relativeFallbackFrame(from: state.placements, spec: spec, among: screens) {
                // Docked at a never-seen location: seed from the most-recent
                // placement's relative position, then persist under the new set.
                apply(resolved.frame, to: window, on: resolved.screen, spec: spec, id: id)
                saveFrame(for: window, id: id)
            } else {
                // No usable placement → just keep the window fully on-screen.
                reclamp(window, spec: spec, among: screens, id: id)
            }
        }
    }

    /// Validates against the target screen and applies only a real change.
    private func apply(_ frame: NSRect, to window: NSWindow, on screen: ScreenInfo, spec: WindowSpec, id: String) {
        let validated = FrameCalculator.validateFrame(
            frame, screenVisibleFrame: screen.visibleFrame, minSize: spec.minSize
        )
        guard validated != window.frame else { return }
        window.setFrame(validated, display: true, animate: window.isVisible)
        logger.debug("WindowFrameManager: repositioned '\(id, privacy: .public)' after screen change")
    }

    /// Minimal fallback for windows without a usable placement: keep the
    /// current frame but push it fully on screen.
    private func reclamp(_ window: NSWindow, spec: WindowSpec, among screens: [ScreenInfo], id: String) {
        guard let screen = Self.bestScreen(for: window, among: screens) else { return }
        apply(window.frame, to: window, on: screen, spec: spec, id: id)
    }

    /// Live managed windows keyed by their `id` (the `wm_<id>` identifier tag),
    /// visible or not. Empty in headless contexts (no NSApp). Built once per
    /// screen-change event so repositioning is O(windows), not O(specs×windows).
    private func managedWindowsByID() -> [String: NSWindow] {
        var map: [String: NSWindow] = [:]
        for window in windowLister() {
            guard let raw = window.identifier?.rawValue, raw.hasPrefix("wm_") else { continue }
            map[String(raw.dropFirst("wm_".count))] = window
        }
        return map
    }

    // MARK: - Placement resolution

    /// Builds the frame for a saved placement on the current screens, honoring
    /// match quality: an **exact** screen match (same display, same resolution)
    /// replays the literal top-left offset; anything less (resolution changed,
    /// name-only, or main-only match) uses the saved **relative** position,
    /// since the absolute offset no longer maps onto the new geometry. Returns
    /// the validated frame, the target screen, and whether the match was exact
    /// (so callers can decide whether to re-persist). Requires `screens`
    /// non-empty (every caller guards this).
    private func resolvedFrame(
        for placement: WindowPlacement, spec: WindowSpec, among screens: [ScreenInfo]
    ) -> (frame: NSRect, screen: ScreenInfo, isExact: Bool) {
        let match = ScreenMatcher.findBestMatch(for: placement.screenFingerprint, among: screens)
        let screen = match?.screen ?? screenProvider.mainScreen ?? screens[0]
        let size = NSSize(width: placement.width, height: placement.height)
        let isExact = match?.quality == .exact
        let raw: NSRect
        if isExact {
            raw = FrameCalculator.frame(
                topLeftOffset: CGPoint(x: placement.topLeftX, y: placement.topLeftY),
                size: size,
                screenVisibleFrame: screen.visibleFrame
            )
        } else {
            raw = FrameCalculator.frame(
                relativePosition: CGPoint(x: placement.relativeX, y: placement.relativeY),
                size: size,
                screenVisibleFrame: screen.visibleFrame,
                minSize: spec.minSize
            )
        }
        let validated = FrameCalculator.validateFrame(
            raw, screenVisibleFrame: screen.visibleFrame, minSize: spec.minSize
        )
        return (validated, screen, isExact)
    }

    /// Builds a frame from the most-recently-saved placement's relative
    /// position on the main screen — the fallback for a screen set this window
    /// has never been placed in. Returns nil when there are no placements to
    /// fall back to. Requires `screens` non-empty.
    private func relativeFallbackFrame(
        from placements: [String: WindowPlacement], spec: WindowSpec, among screens: [ScreenInfo]
    ) -> (frame: NSRect, screen: ScreenInfo)? {
        guard let fallback = placements.values.max(by: { $0.savedAt < $1.savedAt }) else { return nil }
        let screen = screenProvider.mainScreen ?? screens[0]
        let raw = FrameCalculator.frame(
            relativePosition: CGPoint(x: fallback.relativeX, y: fallback.relativeY),
            size: NSSize(width: fallback.width, height: fallback.height),
            screenVisibleFrame: screen.visibleFrame,
            minSize: spec.minSize
        )
        let validated = FrameCalculator.validateFrame(
            raw, screenVisibleFrame: screen.visibleFrame, minSize: spec.minSize
        )
        return (validated, screen)
    }

    // MARK: - Screen Helpers

    /// Returns the screen containing the largest portion of the window.
    public static func bestScreen(for window: NSWindow, among screens: [ScreenInfo]) -> ScreenInfo? {
        var bestScreen: ScreenInfo?
        var bestArea: CGFloat = 0
        for screen in screens {
            let intersection = window.frame.intersection(screen.visibleFrame)
            if !intersection.isNull {
                let area = intersection.width * intersection.height
                if area > bestArea {
                    bestArea = area
                    bestScreen = screen
                }
            }
        }
        if let best = bestScreen { return best }
        // Fall back to window's own screen or main
        if let windowScreen = window.screen {
            return RealScreenInfo(screen: windowScreen)
        }
        return NSScreen.main.map { RealScreenInfo(screen: $0) }
    }
}

extension WindowFrameManager: Loggable {
    public static nonisolated let logger = makeLogger()
}

extension SingleWindowController {

    /// Convenience accessor for the spec registered for this controller's
    /// `windowID`. Reads/writes go through the owning
    /// `WindowFrameManager`.
    public var windowSpec: WindowSpec? {
        get { WindowManager.shared.frames.windowSpecs[windowID] }
        set { WindowManager.shared.frames.windowSpecs[windowID] = newValue }
    }
}

import AgenticToolkitCore
import AppKit
import CoreGraphics
import Foundation
import os.log

/// Manages system-window contexts and orchestrates window switching.
///
/// SystemWindowContextManager owns the list of contexts, tracks which context is
/// active, and coordinates off-screen parking and position restoration when the
/// user switches between contexts. It deals only with window/context state —
/// application settings are the host app's responsibility.
///
/// All mutations are persisted via SystemWindowContextStore after every change.
///
/// Confined to the main actor: the engine is driven by main-run-loop observer
/// callbacks and mutates its context state without internal locking, so `@MainActor`
/// enforces that invariant at compile time rather than by convention.
@MainActor
public final class SystemWindowContextManager: Loggable {

    /// How far to the left of every display inactive windows are parked, so a parked
    /// window can never land on a real screen (even on multi-monitor layouts).
    public static let parkingMargin: CGFloat = 30_000

    public static nonisolated let logger = makeLogger()

    /// All contexts, in display order.
    public private(set) var contexts: [SystemWindowContext]

    /// The ID of the currently active context, or nil if none is active.
    public private(set) var activeContextID: UUID?

    /// The window manager used for listing and manipulating windows.
    private let windowManager: SystemWindowControlling

    /// The store used for persistence.
    private let stateStore: SystemWindowContextStore

    /// The window matcher used for creating fingerprints from live windows.
    private let windowMatcher: SystemWindowMatcher

    /// The custom heuristic store for loading/saving user-defined rules.
    private let customHeuristicStore: CustomHeuristicStore

    /// The currently loaded custom heuristic rules.
    public private(set) var customHeuristicRules: [CustomHeuristicRule] = []

    /// The on-disk directory where context state is persisted. Exposed so a
    /// host's settings UI can show (and reveal) the state location without
    /// hard-coding an app-specific path.
    public var rootDirectory: URL { stateStore.rootDirectory }

    // MARK: - Initialization

    /// Creates a manager with the given dependencies.
    public init(
        windowManager: SystemWindowControlling,
        stateStore: SystemWindowContextStore,
        windowMatcher: SystemWindowMatcher = SystemWindowMatcher(),
        customHeuristicStore: CustomHeuristicStore? = nil
    ) {
        self.windowManager = windowManager
        self.stateStore = stateStore
        self.windowMatcher = windowMatcher
        self.customHeuristicStore = customHeuristicStore
            ?? CustomHeuristicStore(rootDirectory: stateStore.rootDirectory)
        self.contexts = []
        self.activeContextID = nil
    }

    /// Loads state from disk. Call this once at startup.
    public func loadState() throws {
        Self.logger.info("Loading state from disk")
        let state = try stateStore.loadState()
        self.activeContextID = state.activeContextID
        self.contexts = try stateStore.loadAllContexts()
        let activeDescription = self.activeContextID?.uuidString ?? "none"
        Self.logger.info("Loaded \(self.contexts.count) contexts, active: \(activeDescription)")

        // CGWindowIDs are not stable across reboots/app restarts, so a persisted
        // windowID may now point at a different window (or none). Invalidate any that
        // no longer match a live window of the same app, marking those snapshots dormant
        // so they become eligible for fingerprint re-matching (call
        // `performLaunchReMatching()` next to re-attach them).
        reconcilePersistedWindowIDs()

        // Load and register custom heuristic rules
        loadCustomHeuristicRules()
    }

    /// Drops persisted windowIDs that no longer correspond to a live window of the same
    /// app (e.g. after a reboot recycled them), marking those snapshots dormant. Without
    /// this, `hasStaleWindows` (a nil check) stays false and the engine would act on
    /// recycled IDs instead of re-matching by fingerprint.
    private func reconcilePersistedWindowIDs() {
        var liveByID: [UInt32: SystemWindowInfo] = [:]
        var liveAppNames: Set<String> = []
        for window in windowManager.listAllWindows() {
            liveByID[window.id] = window
            liveAppNames.insert(window.app.lowercased())
        }

        var invalidated = 0
        for contextIndex in 0..<contexts.count {
            for snapshotIndex in 0..<contexts[contextIndex].windowSnapshots.count {
                let snapshot = contexts[contextIndex].windowSnapshots[snapshotIndex]
                guard let windowID = snapshot.windowID else { continue }
                let app = snapshot.app.lowercased()

                let shouldInvalidate: Bool
                if let live = liveByID[windowID] {
                    // ID is in use — valid only if it still belongs to the same app
                    // (else the OS recycled it to a different application).
                    shouldInvalidate = live.app.lowercased() != app
                } else {
                    // ID not in the live list. Only invalidate if the owning app is
                    // actually enumerable (has at least one live window). An app with
                    // zero live windows may still be mid-launch at this instant; nilling
                    // here would orphan a valid window, so leave it and let the window
                    // observer / fingerprint re-matching reconcile it once it appears.
                    shouldInvalidate = liveAppNames.contains(app)
                }

                if shouldInvalidate {
                    contexts[contextIndex].windowSnapshots[snapshotIndex].windowID = nil
                    invalidated += 1
                }
            }
        }

        if invalidated > 0 {
            Self.logger.info("Invalidated \(invalidated) stale window ID(s) on load")
            try? persistState()
        }
    }

    // MARK: - Window Re-matching

    /// Whether any context has dormant (stale) window snapshots that need re-matching.
    public var hasStaleWindows: Bool {
        contexts.contains { context in
            context.windowSnapshots.contains { !$0.isLive }
        }
    }

    /// Runs the re-matching engine against currently running windows.
    public func runReMatching() -> SystemWindowMatcher.MatchResult {
        let liveWindows = windowManager.listAllWindows()
        return windowMatcher.matchWindows(contexts: contexts, liveWindows: liveWindows)
    }

    /// Applies matched pairs from a re-matching result to update context snapshots.
    ///
    /// Every pair in `matchResult.matched` has already cleared the matcher's
    /// auto-assign threshold (filtering happens in `SystemWindowMatcher.matchWindows`),
    /// so each is applied unconditionally here.
    @discardableResult
    public func applyMatches(
        _ matchResult: SystemWindowMatcher.MatchResult
    ) throws -> Int {
        var applied = 0

        for match in matchResult.matched {
            guard let contextIndex = contexts.firstIndex(where: { $0.id == match.contextID }) else {
                continue
            }

            var savedFrameY: CGFloat = 0
            let updated = contexts[contextIndex].updateSnapshot(id: match.snapshotID) { snapshot in
                snapshot.windowID = match.window.id
                snapshot.title = match.window.title
                snapshot.lastSeen = Date()
                savedFrameY = snapshot.savedFrame.origin.y
            }
            guard updated else { continue }

            // The re-matched window is live and visible; park it if its context is inactive.
            parkWindowIfContextInactive(
                windowID: match.window.id,
                contextID: match.contextID,
                savedFrameY: savedFrameY
            )
            applied += 1
        }

        if applied > 0 {
            try persistState()
        }

        return applied
    }

    /// Performs automatic re-matching on app launch if stale window IDs are detected.
    public func performLaunchReMatching() throws -> SystemWindowMatcher.MatchResult? {
        guard hasStaleWindows else { return nil }

        let result = runReMatching()
        try applyMatches(result)
        return result
    }

    /// Assigns a single live window to a specific dormant snapshot.
    public func assignWindowToSnapshot(
        windowID: UInt32,
        snapshotID: UUID,
        contextID: UUID
    ) throws {
        guard let contextIndex = contexts.firstIndex(where: { $0.id == contextID }) else {
            throw SystemWindowContextError.contextNotFound(id: contextID)
        }

        // Get the live window's current title
        let allWindows = windowManager.listAllWindows()
        let windowTitle = allWindows.first(where: { $0.id == windowID })?.title ?? ""

        var savedFrameY: CGFloat = 0
        let updated = contexts[contextIndex].updateSnapshot(id: snapshotID) { snapshot in
            snapshot.windowID = windowID
            snapshot.title = windowTitle
            snapshot.lastSeen = Date()
            savedFrameY = snapshot.savedFrame.origin.y
        }
        guard updated else {
            throw SystemWindowContextError.windowNotInAnyContext(windowID: windowID)
        }

        // If assigned to an inactive context, park the now-attached window.
        parkWindowIfContextInactive(windowID: windowID, contextID: contextID, savedFrameY: savedFrameY)
        try persistState()
    }

    /// Removes a dormant snapshot from its context.
    public func removeDormantSnapshot(snapshotID: UUID, contextID: UUID) throws {
        guard let contextIndex = contexts.firstIndex(where: { $0.id == contextID }) else {
            throw SystemWindowContextError.contextNotFound(id: contextID)
        }

        contexts[contextIndex].removeWindow(id: snapshotID)
        try persistState()
    }

    /// A dormant snapshot together with its owning context's display info.
    public struct DormantSnapshot: Sendable {
        public let contextID: UUID
        public let contextName: String
        public let contextColor: String
        public let snapshot: SystemWindowSnapshot
    }

    /// Returns all dormant snapshots with their context information.
    public func dormantSnapshots() -> [DormantSnapshot] {
        var result: [DormantSnapshot] = []
        for context in contexts {
            for snapshot in context.windowSnapshots where !snapshot.isLive {
                result.append(DormantSnapshot(
                    contextID: context.id,
                    contextName: context.name,
                    contextColor: context.color,
                    snapshot: snapshot
                ))
            }
        }
        return result
    }

    /// Scores a specific live window against a specific fingerprint.
    public func scoreWindow(
        _ window: SystemWindowInfo,
        against fingerprint: SystemWindowFingerprint
    ) -> Int {
        windowMatcher.score(window: window, against: fingerprint)
    }

    // MARK: - Context CRUD

    /// Creates a new context with the given name and optional color.
    @discardableResult
    public func createContext(name: String, color: String = "#007AFF") throws -> SystemWindowContext {
        let context = SystemWindowContext(name: name, color: color)
        contexts.append(context)
        try persistState()
        Self.logger.info("Created context '\(name)' (\(context.id))")
        return context
    }

    /// Deletes the context with the given ID.
    public func deleteContext(id: UUID) throws {
        guard let index = contexts.firstIndex(where: { $0.id == id }) else {
            throw SystemWindowContextError.contextNotFound(id: id)
        }

        let context = contexts[index]
        Self.logger.info("Deleting context '\(context.name)' (\(context.windowSnapshots.count) windows)")

        if activeContextID == id {
            // Deleting the active context leaves no active context, so nothing should stay
            // parked. Un-park every context's windows (not just the deleted one); otherwise
            // the other contexts' windows are stranded off-screen with no way back.
            activeContextID = nil
            for other in contexts {
                restoreWindowsToSavedPositions(other)
            }
        } else {
            // Deleting an inactive context: its windows are parked — restore them.
            restoreWindowsToSavedPositions(context)
        }

        contexts.remove(at: index)

        try stateStore.deleteContext(id: id)
        try persistState()
        Self.logger.info("Deleted context '\(context.name)'")
    }

    /// Renames the context with the given ID.
    public func renameContext(id: UUID, to newName: String) throws {
        guard let index = contexts.firstIndex(where: { $0.id == id }) else {
            throw SystemWindowContextError.contextNotFound(id: id)
        }

        contexts[index].name = newName
        try persistState()
    }

    /// Updates the color of the context with the given ID.
    public func updateContextColor(id: UUID, to newColor: String) throws {
        guard let index = contexts.firstIndex(where: { $0.id == id }) else {
            throw SystemWindowContextError.contextNotFound(id: id)
        }

        contexts[index].color = newColor
        try persistState()
    }

    // MARK: - Window Assignment

    /// Adds a window to the specified context.
    @discardableResult
    public func addWindow(windowID: UInt32, to contextID: UUID) throws -> SystemWindowSnapshot {
        // Check if window is already in a context
        if let existingContext = contexts.first(where: { context in
            context.windowSnapshots.contains(where: { $0.windowID == windowID })
        }) {
            if existingContext.id == contextID {
                // Already in this context -- update the snapshot
                return try updateWindowSnapshot(windowID: windowID, in: contextID)
            }
            throw SystemWindowContextError.windowAlreadyAssigned(
                windowID: windowID,
                contextName: existingContext.name
            )
        }

        guard let index = contexts.firstIndex(where: { $0.id == contextID }) else {
            throw SystemWindowContextError.contextNotFound(id: contextID)
        }

        // Look up the window to get its current frame
        let allWindows = windowManager.listAllWindows()
        guard let windowInfo = allWindows.first(where: { $0.id == windowID }) else {
            throw SystemWindowContextError.windowNotFound(windowID: windowID)
        }

        // Create a fingerprint using heuristic-based pattern extraction.
        let fingerprint = windowMatcher.fingerprint(window: windowInfo)

        let snapshot = SystemWindowSnapshot(
            windowID: windowID,
            fingerprint: fingerprint,
            savedFrame: windowInfo.frame,
            display: windowInfo.display,
            app: windowInfo.app,
            title: windowInfo.title
        )

        contexts[index].addWindow(snapshot)
        // If the target context isn't active, park the window so it doesn't stay visible
        // over the active context's windows.
        parkWindowIfContextInactive(
            windowID: windowID,
            contextID: contextID,
            savedFrameY: snapshot.savedFrame.origin.y
        )
        try persistState()
        Self.logger.info("Added window \(windowID) to '\(self.contexts[index].name)'")
        return snapshot
    }

    /// Removes a window from its context.
    @discardableResult
    public func removeWindow(windowID: UInt32) throws -> SystemWindowSnapshot {
        for index in 0..<contexts.count {
            if let snapshot = contexts[index].removeWindow(windowID: windowID) {
                // If this window is in an inactive context, it may be parked.
                // Restore it so it becomes visible.
                if contexts[index].id != activeContextID, let liveWindowID = snapshot.windowID {
                    try? windowManager.setFrame(windowID: liveWindowID, to: snapshot.savedFrame)
                }
                try persistState()
                return snapshot
            }
        }

        throw SystemWindowContextError.windowNotInAnyContext(windowID: windowID)
    }

    // MARK: - Context Switching

    /// Switches to the context with the given ID.
    ///
    /// 1. Save current positions of the active context's windows
    /// 2. Park all non-target contexts' windows off-screen (x: -30000)
    /// 3. Restore the target context's windows to their saved positions
    /// 4. Focus the last-focused window in the target context
    /// 5. Update the active context and persist state
    public func switchContext(to targetID: UUID) throws {
        guard let targetIndex = contexts.firstIndex(where: { $0.id == targetID }) else {
            throw SystemWindowContextError.contextNotFound(id: targetID)
        }

        // If switching to the same context, just ensure windows are visible
        if activeContextID == targetID {
            restoreWindowsToSavedPositions(contexts[targetIndex])
            try persistState()
            return
        }

        let previousName = activeContext?.name ?? "(none)"
        let targetName = contexts[targetIndex].name
        Self.logger.info("Switching context: '\(previousName)' -> '\(targetName)'")

        // Step 1 & 2: Save and park all non-target contexts' windows.
        for index in 0..<contexts.count {
            guard contexts[index].id != targetID else { continue }

            if contexts[index].id == activeContextID {
                // Active context: save current positions, then park
                saveAndParkContext(at: index)
            } else {
                // Inactive context: just ensure windows are parked
                parkContext(at: index)
            }
        }

        // Step 3: Restore target context's windows to saved positions
        restoreWindowsToSavedPositions(contexts[targetIndex])

        // Step 4: Focus the last-focused window in the target context
        focusLastFocusedWindow(in: contexts[targetIndex])

        // Step 5: Update active context and persist
        activeContextID = targetID
        try persistState()
        Self.logger.info("Switch complete -> '\(targetName)'")
    }

    /// Returns the currently active context, if any.
    public var activeContext: SystemWindowContext? {
        guard let id = activeContextID else { return nil }
        return contexts.first(where: { $0.id == id })
    }

    /// Returns the context containing the given window, if any.
    public func context(for windowID: UInt32) -> SystemWindowContext? {
        contexts.first { context in
            context.windowSnapshots.contains(where: { $0.windowID == windowID })
        }
    }

    /// Updates the last-focused window for the active context.
    public func setLastFocusedWindow(windowID: UInt32) throws {
        guard let activeID = activeContextID,
              let index = contexts.firstIndex(where: { $0.id == activeID }) else {
            return
        }

        if let snapshot = contexts[index].windowSnapshots.first(where: { $0.windowID == windowID }) {
            contexts[index].lastFocusedWindowID = snapshot.id
            try persistState()
        }
    }

    // MARK: - Window Observation Events

    /// Marks a window as dormant (keeps fingerprint, clears windowID).
    @discardableResult
    public func markWindowDormant(windowID: UInt32) -> SystemWindowSnapshot? {
        for contextIndex in 0..<contexts.count {
            var dormant: SystemWindowSnapshot?
            contexts[contextIndex].updateSnapshot(windowID: windowID) { snapshot in
                snapshot.windowID = nil
                dormant = snapshot
            }
            if let dormant {
                Self.logger.info("Window \(windowID) marked dormant in '\(self.contexts[contextIndex].name)'")
                try? persistState()
                return dormant
            }
        }
        return nil
    }

    /// Marks all windows for a given app as dormant across all contexts.
    @discardableResult
    public func markAppWindowsDormant(appName: String) -> Int {
        var count = 0
        for contextIndex in 0..<contexts.count {
            for snapshotIndex in 0..<contexts[contextIndex].windowSnapshots.count {
                if contexts[contextIndex].windowSnapshots[snapshotIndex].app == appName,
                   contexts[contextIndex].windowSnapshots[snapshotIndex].windowID != nil {
                    contexts[contextIndex].windowSnapshots[snapshotIndex].windowID = nil
                    count += 1
                }
            }
        }
        if count > 0 {
            Self.logger.info("App '\(appName)' terminated, \(count) windows marked dormant")
            try? persistState()
        }
        return count
    }

    /// Updates a window's stored title after its title changed.
    @discardableResult
    public func updateWindowTitle(windowID: UInt32, newTitle: String) -> Bool {
        for contextIndex in 0..<contexts.count {
            let updated = contexts[contextIndex].updateSnapshot(windowID: windowID) { snapshot in
                snapshot.title = newTitle
                snapshot.lastSeen = Date()
            }
            if updated {
                try? persistState()
                return true
            }
        }
        return false
    }

    /// Attempts to re-match dormant windows for a specific app that just launched.
    @discardableResult
    public func reMatchDormantWindowsForApp(appName: String) -> Int {
        let liveWindows = windowManager.listAllWindows()
        let appWindows = liveWindows.filter {
            $0.app.lowercased() == appName.lowercased()
        }

        guard !appWindows.isEmpty else { return 0 }

        // Collect assigned window IDs to avoid double-assignment
        var assignedWindowIDs = Set<UInt32>()
        for context in contexts {
            for snapshot in context.windowSnapshots {
                if let assignedID = snapshot.windowID {
                    assignedWindowIDs.insert(assignedID)
                }
            }
        }

        let candidateWindows = appWindows.filter { !assignedWindowIDs.contains($0.id) }
        guard !candidateWindows.isEmpty else { return 0 }

        var matched = 0

        // Find dormant snapshots for this app
        for contextIndex in 0..<contexts.count {
            for snapshotIndex in 0..<contexts[contextIndex].windowSnapshots.count {
                guard contexts[contextIndex].windowSnapshots[snapshotIndex].app.lowercased()
                        == appName.lowercased(),
                      contexts[contextIndex].windowSnapshots[snapshotIndex].windowID == nil else {
                    continue
                }

                let fingerprint = contexts[contextIndex].windowSnapshots[snapshotIndex].fingerprint

                // Score each candidate window and find the best match
                var bestWindow: SystemWindowInfo?
                var bestScore = 0

                for candidate in candidateWindows {
                    guard !assignedWindowIDs.contains(candidate.id) else { continue }
                    let score = windowMatcher.score(window: candidate, against: fingerprint)
                    if score >= SystemWindowMatcher.autoAssignThreshold && score > bestScore {
                        bestScore = score
                        bestWindow = candidate
                    }
                }

                if let window = bestWindow {
                    contexts[contextIndex].windowSnapshots[snapshotIndex].windowID = window.id
                    contexts[contextIndex].windowSnapshots[snapshotIndex].title = window.title
                    contexts[contextIndex].windowSnapshots[snapshotIndex].lastSeen = Date()
                    parkWindowIfContextInactive(
                        windowID: window.id,
                        contextID: contexts[contextIndex].id,
                        savedFrameY: contexts[contextIndex].windowSnapshots[snapshotIndex].savedFrame.origin.y
                    )
                    assignedWindowIDs.insert(window.id)
                    matched += 1
                }
            }
        }

        if matched > 0 {
            Self.logger.info("App '\(appName)' launched, re-matched \(matched) dormant windows")
            try? persistState()
        }

        return matched
    }

    /// Checks a newly created window against dormant snapshots for auto-assignment.
    @discardableResult
    public func checkNewWindowForAutoAssignment(_ window: SystemWindowInfo) -> UUID? {
        // Check if window is already assigned
        if context(for: window.id) != nil {
            return nil
        }

        var bestContextIndex: Int?
        var bestSnapshotIndex: Int?
        var bestScore = 0

        for contextIndex in 0..<contexts.count {
            for snapshotIndex in 0..<contexts[contextIndex].windowSnapshots.count {
                guard contexts[contextIndex].windowSnapshots[snapshotIndex].windowID == nil else {
                    continue
                }

                let fingerprint = contexts[contextIndex].windowSnapshots[snapshotIndex].fingerprint
                let score = windowMatcher.score(window: window, against: fingerprint)

                if score >= SystemWindowMatcher.autoAssignThreshold && score > bestScore {
                    bestScore = score
                    bestContextIndex = contextIndex
                    bestSnapshotIndex = snapshotIndex
                }
            }
        }

        if let contextIndex = bestContextIndex, let snapshotIndex = bestSnapshotIndex {
            contexts[contextIndex].windowSnapshots[snapshotIndex].windowID = window.id
            contexts[contextIndex].windowSnapshots[snapshotIndex].title = window.title
            contexts[contextIndex].windowSnapshots[snapshotIndex].lastSeen = Date()
            parkWindowIfContextInactive(
                windowID: window.id,
                contextID: contexts[contextIndex].id,
                savedFrameY: contexts[contextIndex].windowSnapshots[snapshotIndex].savedFrame.origin.y
            )
            try? persistState()
            Self.logger.info("Auto-assigned \(window.id) to '\(self.contexts[contextIndex].name)' (score \(bestScore))")
            return contexts[contextIndex].id
        }

        return nil
    }

    // MARK: - Custom Heuristic Rules

    /// Loads custom heuristic rules from disk and registers them with the registry.
    public func loadCustomHeuristicRules() {
        do {
            customHeuristicRules = try customHeuristicStore.loadRules()
            windowMatcher.registry.registerCustomRules(customHeuristicRules)
        } catch {
            Self.logger.error("Failed to load custom heuristic rules: \(error.localizedDescription)")
            customHeuristicRules = []
        }
    }

    /// Adds a new custom heuristic rule.
    ///
    /// Persists first, then commits the change in memory and to the registry, so a failed
    /// write leaves memory, disk, and the registry consistent (no phantom rule).
    public func addCustomHeuristicRule(_ rule: CustomHeuristicRule) throws {
        var updated = customHeuristicRules
        updated.append(rule)
        try customHeuristicStore.saveRules(updated)
        customHeuristicRules = updated
        windowMatcher.registry.registerCustomRules(updated)
    }

    /// Updates an existing custom heuristic rule.
    public func updateCustomHeuristicRule(_ rule: CustomHeuristicRule) throws {
        guard let index = customHeuristicRules.firstIndex(where: { $0.id == rule.id }) else {
            return
        }
        var updated = customHeuristicRules
        updated[index] = rule
        try customHeuristicStore.saveRules(updated)
        customHeuristicRules = updated
        windowMatcher.registry.registerCustomRules(updated)
    }

    /// Deletes a custom heuristic rule by ID.
    public func deleteCustomHeuristicRule(id ruleID: UUID) throws {
        var updated = customHeuristicRules
        updated.removeAll { $0.id == ruleID }
        try customHeuristicStore.saveRules(updated)
        customHeuristicRules = updated
        windowMatcher.registry.registerCustomRules(updated)
    }

    /// Checks a new window against custom heuristic rules for auto-assignment.
    public func checkCustomRulesForAutoAssignment(_ window: SystemWindowInfo) -> UUID? {
        // Check if window is already assigned to any context
        if context(for: window.id) != nil {
            return nil
        }

        for rule in customHeuristicRules {
            guard rule.autoAssign else { continue }
            guard rule.appName.lowercased() == window.app.lowercased() else { continue }
            guard rule.matchTitle(window.title) != nil else { continue }

            // Find the target context by name
            guard let targetName = rule.targetContextName,
                  let targetContext = contexts.first(where: {
                      $0.name.lowercased() == targetName.lowercased()
                  }) else {
                continue
            }

            // Create a fingerprint and add the window to the target context
            let fingerprint = windowMatcher.fingerprint(window: window)
            let snapshot = SystemWindowSnapshot(
                windowID: window.id,
                fingerprint: fingerprint,
                savedFrame: window.frame,
                display: window.display,
                app: window.app,
                title: window.title
            )

            if let index = contexts.firstIndex(where: { $0.id == targetContext.id }) {
                contexts[index].addWindow(snapshot)
                parkWindowIfContextInactive(
                    windowID: window.id,
                    contextID: targetContext.id,
                    savedFrameY: snapshot.savedFrame.origin.y
                )
                try? persistState()
                return targetContext.id
            }
        }

        return nil
    }

    // MARK: - Private Helpers

    /// X coordinate to the left of every display where inactive windows are parked.
    private var parkingX: CGFloat {
        leftmostDisplayMinX - Self.parkingMargin
    }

    /// The left edge of the leftmost display; X positions below this are off every screen.
    private var leftmostDisplayMinX: CGFloat {
        NSScreen.screens.map(\.frame.minX).min() ?? 0
    }

    /// Parks a single live window off-screen, preserving its saved Y so it restores in
    /// place. Best-effort: AX failures are swallowed.
    private func parkWindow(_ windowID: UInt32, savedFrameY: CGFloat) {
        try? windowManager.move(windowID: windowID, to: CGPoint(x: parkingX, y: savedFrameY))
    }

    /// Parks a just-attached window when its owning context is not active, so an
    /// auto-assigned or re-matched window doesn't stay visible over the active context.
    /// No-op when there is no active context (nothing is parked in that state).
    private func parkWindowIfContextInactive(windowID: UInt32, contextID: UUID, savedFrameY: CGFloat) {
        guard let activeContextID, contextID != activeContextID else { return }
        parkWindow(windowID, savedFrameY: savedFrameY)
    }

    /// Captures a window's current frame into its snapshot — but only while the window is
    /// genuinely on a real screen. If it's already parked (or the OS clamped a park move
    /// to a not-quite-off-screen X), the live frame is NOT saved, so a parked/clamped
    /// position can never be persisted as the restore target. Also preserves interim moves
    /// of an on-screen window.
    private func captureFrameIfOnScreen(
        contextIndex: Int,
        snapshotIndex: Int,
        liveWindows: [SystemWindowInfo]
    ) {
        guard let windowID = contexts[contextIndex].windowSnapshots[snapshotIndex].windowID,
              let live = liveWindows.first(where: { $0.id == windowID }),
              SystemWindowManager.isOnScreenHorizontally(live.frame) else {
            return
        }
        contexts[contextIndex].windowSnapshots[snapshotIndex].savedFrame = live.frame
        contexts[contextIndex].windowSnapshots[snapshotIndex].lastSeen = Date()
    }

    /// Saves current window positions and parks all windows in the context off-screen.
    private func saveAndParkContext(at index: Int) {
        let allWindows = windowManager.listAllWindows()

        for snapshotIndex in 0..<contexts[index].windowSnapshots.count {
            guard let windowID = contexts[index].windowSnapshots[snapshotIndex].windowID else {
                continue // Dormant window, skip
            }
            captureFrameIfOnScreen(contextIndex: index, snapshotIndex: snapshotIndex, liveWindows: allWindows)
            let savedFrame = contexts[index].windowSnapshots[snapshotIndex].savedFrame
            parkWindow(windowID, savedFrameY: savedFrame.origin.y)
        }
    }

    /// Parks all live windows in a context off-screen. Also captures the live frame of any
    /// window that happens to be on-screen first, so an interim move isn't lost on restore.
    private func parkContext(at index: Int) {
        let allWindows = windowManager.listAllWindows()

        for snapshotIndex in 0..<contexts[index].windowSnapshots.count {
            guard let windowID = contexts[index].windowSnapshots[snapshotIndex].windowID else {
                continue // Dormant window, skip
            }
            captureFrameIfOnScreen(contextIndex: index, snapshotIndex: snapshotIndex, liveWindows: allWindows)
            let savedFrame = contexts[index].windowSnapshots[snapshotIndex].savedFrame
            parkWindow(windowID, savedFrameY: savedFrame.origin.y)
        }
    }

    /// Restores all live windows in a context to their saved positions.
    private func restoreWindowsToSavedPositions(_ context: SystemWindowContext) {
        for snapshot in context.windowSnapshots {
            guard let windowID = snapshot.windowID else {
                continue // Dormant window, skip
            }

            try? windowManager.setFrame(windowID: windowID, to: snapshot.savedFrame)
        }
    }

    /// Focuses the last-focused window in the given context.
    private func focusLastFocusedWindow(in context: SystemWindowContext) {
        // Try the recorded last-focused window first
        if let lastFocusedID = context.lastFocusedWindowID,
           let snapshot = context.snapshot(id: lastFocusedID),
           let windowID = snapshot.windowID {
            try? windowManager.focus(windowID: windowID)
            return
        }

        // Fallback: focus the first live window
        if let firstLive = context.windowSnapshots.first(where: { $0.isLive }),
           let windowID = firstLive.windowID {
            try? windowManager.focus(windowID: windowID)
        }
    }

    /// Updates an existing window snapshot's frame in a context.
    private func updateWindowSnapshot(windowID: UInt32, in contextID: UUID) throws -> SystemWindowSnapshot {
        guard let contextIndex = contexts.firstIndex(where: { $0.id == contextID }) else {
            throw SystemWindowContextError.contextNotFound(id: contextID)
        }

        let allWindows = windowManager.listAllWindows()
        guard let windowInfo = allWindows.first(where: { $0.id == windowID }) else {
            throw SystemWindowContextError.windowNotFound(windowID: windowID)
        }

        guard let snapshotIndex = contexts[contextIndex].windowSnapshots.firstIndex(
            where: { $0.windowID == windowID }
        ) else {
            throw SystemWindowContextError.windowNotInAnyContext(windowID: windowID)
        }

        contexts[contextIndex].windowSnapshots[snapshotIndex].savedFrame = windowInfo.frame
        contexts[contextIndex].windowSnapshots[snapshotIndex].title = windowInfo.title
        contexts[contextIndex].windowSnapshots[snapshotIndex].lastSeen = Date()

        try persistState()
        return contexts[contextIndex].windowSnapshots[snapshotIndex]
    }

    /// Persists the current state (all contexts + contexts state) to disk.
    private func persistState() throws {
        do {
            try stateStore.saveAll(
                contexts: contexts,
                activeContextID: activeContextID
            )
        } catch {
            Self.logger.error("Failed to persist state: \(error.localizedDescription)")
            throw SystemWindowContextError.persistenceFailed(underlying: error)
        }
    }
}

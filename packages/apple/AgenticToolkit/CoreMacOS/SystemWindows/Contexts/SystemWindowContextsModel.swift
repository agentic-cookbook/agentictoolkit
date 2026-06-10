import AppKit
import Combine
import Foundation
import os.log
import AgenticToolkitCore
@preconcurrency import UserNotifications

/// Host-supplied branding and defaults for `SystemWindowContextsModel`.
///
/// Everything app-specific that the orchestrator needs is injected here so the
/// model itself stays app-neutral and reusable across hosts.
public struct SystemWindowContextsConfiguration: Sendable {

    /// A context created on first launch when no contexts exist yet.
    public struct DefaultContext: Sendable {
        public let name: String
        public let color: String
        public init(name: String, color: String) {
            self.name = name
            self.color = color
        }
    }

    /// Name of the host app's own windows, excluded from window listings and
    /// "add frontmost window" actions. `nil` excludes nothing.
    public let selfAppName: String?

    /// `UserSettings` storage key for the persisted settings blob.
    public let settingsKey: String

    /// Singular noun for a context in user-facing error messages (e.g. "Hairball"
    /// or the default, "context").
    public let contextNoun: String

    /// Plural noun for contexts in user-facing labels (e.g. "Hairballs" or the
    /// default, "contexts"). Defaults to `contextNoun` + "s".
    public let contextNounPlural: String

    /// Title for the reconcile user-notification.
    public let notificationTitle: String

    /// Identifier for the reconcile user-notification request.
    public let notificationIdentifier: String

    /// Contexts created on first launch when none exist.
    public let defaultContexts: [DefaultContext]

    public init(
        selfAppName: String? = nil,
        settingsKey: String,
        contextNoun: String = "context",
        contextNounPlural: String? = nil,
        notificationTitle: String,
        notificationIdentifier: String,
        defaultContexts: [DefaultContext] = []
    ) {
        self.selfAppName = selfAppName
        self.settingsKey = settingsKey
        self.contextNoun = contextNoun
        self.contextNounPlural = contextNounPlural ?? (contextNoun + "s")
        self.notificationTitle = notificationTitle
        self.notificationIdentifier = notificationIdentifier
        self.defaultContexts = defaultContexts
    }
}

/// Observable orchestrator that bridges `SystemWindowContextManager` to SwiftUI.
///
/// This is the single source of truth for a window-contexts UI. It wraps
/// `SystemWindowContextManager` and publishes changes so SwiftUI views can
/// react. All mutations go through its methods, which call the manager and then
/// publish updates. Host-specific branding (app name, default contexts,
/// notification strings) is injected via `SystemWindowContextsConfiguration`.
@MainActor
public final class SystemWindowContextsModel: ObservableObject {

    /// All task contexts in display order.
    @Published public private(set) var contexts: [SystemWindowContext] = []

    /// The ID of the currently active context.
    @Published public private(set) var activeContextID: UUID?

    /// Error message to display, if any.
    @Published public var lastError: String?

    /// Whether the reconcile window should be shown.
    @Published public var showReconcileWindow = false

    /// Whether the context picker popup should be shown.
    @Published public var showContextPicker = false

    /// Whether the help panel should be shown.
    @Published public var showHelp = false

    /// Whether the discovery window should be shown.
    @Published public var showDiscovery = false

    /// The list of unmatched items for the Reconcile UI.
    @Published public private(set) var unmatchedItems: [ReconcileItem] = []

    /// The custom heuristic rules currently loaded, for display in the Settings UI.
    @Published public private(set) var customHeuristicRules: [CustomHeuristicRule] = []

    /// Whether to send macOS notifications. Disabled in tests.
    public var notificationsEnabled: Bool = true

    /// Whether window observation is enabled. Disabled in tests.
    public var observationEnabled: Bool = true

    /// The cached match result from launch re-matching.
    private var lastMatchResult: SystemWindowMatcher.MatchResult?

    /// The underlying context manager.
    private let contextManager: SystemWindowContextManager

    /// The window manager for frontmost-window queries.
    private let windowManager: SystemWindowControlling

    /// The window observer for live window event monitoring.
    private var windowObserver: SystemWindowObserver?

    /// Host-supplied branding and defaults.
    private let configuration: SystemWindowContextsConfiguration

    /// App settings, persisted via the toolkit's UserSettings — separate from the
    /// window-context state, which the toolkit's context store owns.
    private let settingsSetting: UserSetting<SystemWindowContextsSettings>

    // MARK: - Initialization

    public init(
        contextManager: SystemWindowContextManager,
        windowManager: SystemWindowControlling,
        configuration: SystemWindowContextsConfiguration
    ) {
        self.contextManager = contextManager
        self.windowManager = windowManager
        self.configuration = configuration
        self.settingsSetting = UserSetting<SystemWindowContextsSettings>(
            configuration.settingsKey,
            default: SystemWindowContextsSettings()
        )
        // Disable notifications and observation in test environments
        if NSClassFromString("XCTestCase") != nil {
            self.notificationsEnabled = false
            self.observationEnabled = false
        }
    }

    /// Loads persisted state from disk. Call once at startup.
    /// Creates the configured default contexts on first launch if none exist.
    public func loadState() {
        do {
            try contextManager.loadState()
            syncFromManager()
            if contexts.isEmpty && observationEnabled {
                createDefaultContexts()
            }
        } catch {
            lastError = "Failed to load state: \(error.localizedDescription)"
            logger.error("Failed to load state: \(error.localizedDescription)")
        }
    }

    /// Creates the configured set of default contexts on first launch.
    private func createDefaultContexts() {
        for item in configuration.defaultContexts {
            do {
                try contextManager.createContext(name: item.name, color: item.color)
            } catch {
                logger.error("Failed to create default context '\(item.name)': \(error.localizedDescription)")
            }
        }
        syncFromManager()
        logger.info("Created \(self.configuration.defaultContexts.count) default contexts")
    }

    // MARK: - Custom Heuristic Rules

    /// Adds a new custom heuristic rule.
    public func addCustomHeuristicRule(_ rule: CustomHeuristicRule) {
        do {
            try contextManager.addCustomHeuristicRule(rule)
            customHeuristicRules = contextManager.customHeuristicRules
        } catch {
            lastError = "Failed to add heuristic rule: \(error.localizedDescription)"
            logger.error("Failed to add heuristic rule: \(error.localizedDescription)")
        }
    }

    /// Updates an existing custom heuristic rule.
    public func updateCustomHeuristicRule(_ rule: CustomHeuristicRule) {
        do {
            try contextManager.updateCustomHeuristicRule(rule)
            customHeuristicRules = contextManager.customHeuristicRules
        } catch {
            lastError = "Failed to update heuristic rule: \(error.localizedDescription)"
            logger.error("Failed to update heuristic rule: \(error.localizedDescription)")
        }
    }

    /// Deletes a custom heuristic rule by ID.
    public func deleteCustomHeuristicRule(id: UUID) {
        do {
            try contextManager.deleteCustomHeuristicRule(id: id)
            customHeuristicRules = contextManager.customHeuristicRules
        } catch {
            lastError = "Failed to delete heuristic rule: \(error.localizedDescription)"
            logger.error("Failed to delete heuristic rule: \(error.localizedDescription)")
        }
    }

    /// Returns the built-in heuristics for display in Settings.
    public var builtInHeuristics: [AppHeuristic] {
        HeuristicRegistry.builtInHeuristics
    }

    // MARK: - Reconcile

    /// Performs launch re-matching and opens the Reconcile UI if needed.
    ///
    /// This should be called once during app startup, after loadState().
    /// It runs the re-matching engine, auto-assigns high-confidence matches,
    /// and if any unmatched items remain, opens the Reconcile UI and sends
    /// a macOS notification as a fallback.
    public func performLaunchReconciliation() {
        do {
            guard let matchResult = try contextManager.performLaunchReMatching() else {
                logger.info("No stale windows detected, skipping reconciliation.")
                return
            }

            lastMatchResult = matchResult
            syncFromManager()
            refreshUnmatchedItems()

            if !unmatchedItems.isEmpty {
                logger.info("\(self.unmatchedItems.count) unmatched windows need assignment.")
                showReconcileWindow = true
                sendReconcileNotification(count: unmatchedItems.count)
            } else {
                logger.info("All stale windows auto-matched successfully.")
            }
        } catch {
            lastError = "Re-matching failed: \(error.localizedDescription)"
            logger.error("Re-matching failed: \(error.localizedDescription)")
        }
    }

    /// Assigns a candidate window to an unmatched fingerprint.
    ///
    /// Called from the Reconcile UI when the user clicks "Assign" on a candidate.
    public func assignWindow(candidateWindowID: UInt32, toUnmatchedItem itemID: UUID) {
        guard let item = unmatchedItems.first(where: { $0.id == itemID }) else {
            lastError = "Unmatched item not found."
            return
        }

        do {
            try contextManager.assignWindowToSnapshot(
                windowID: candidateWindowID,
                snapshotID: item.id,
                contextID: item.contextID
            )
            syncFromManager()
            refreshUnmatchedItems()
        } catch {
            lastError = "Failed to assign window: \(error.localizedDescription)"
            logger.error("Failed to assign window: \(error.localizedDescription)")
        }
    }

    /// Skips an unmatched item, removing its dormant snapshot from the context.
    public func skipUnmatchedItem(_ itemID: UUID) {
        guard let item = unmatchedItems.first(where: { $0.id == itemID }) else { return }

        do {
            try contextManager.removeDormantSnapshot(snapshotID: item.id, contextID: item.contextID)
            syncFromManager()
            refreshUnmatchedItems()
        } catch {
            lastError = "Failed to skip item: \(error.localizedDescription)"
            logger.error("Failed to skip item: \(error.localizedDescription)")
        }
    }

    /// Auto-assigns all remaining unmatched items that have at least one candidate.
    ///
    /// For each unmatched item with candidates, the highest-scoring candidate is assigned.
    public func autoAssignAllRemainingMatches() {
        var assignedCount = 0
        // Work on a copy since we mutate during iteration
        let currentItems = unmatchedItems

        for item in currentItems {
            guard let bestCandidate = item.candidates.first else { continue }

            do {
                try contextManager.assignWindowToSnapshot(
                    windowID: bestCandidate.windowID,
                    snapshotID: item.id,
                    contextID: item.contextID
                )
                assignedCount += 1
            } catch {
                logger.error("Failed to auto-assign window \(bestCandidate.windowID): \(error.localizedDescription)")
            }
        }

        if assignedCount > 0 {
            syncFromManager()
            refreshUnmatchedItems()
            logger.info("Auto-assigned \(assignedCount) windows.")
        }
    }

    /// Dismisses the reconcile window.
    public func dismissReconcileWindow() {
        showReconcileWindow = false
    }

    /// Refreshes the unmatched items list from the current context state.
    ///
    /// This queries dormant snapshots and scores all available candidate windows
    /// against each dormant fingerprint to build the reconcile items list.
    public func refreshUnmatchedItems() {
        let dormant = contextManager.dormantSnapshots()
        let liveWindows = windowManager.listAllWindows()

        // Collect window IDs that are already assigned to a context
        var assignedWindowIDs = Set<UInt32>()
        for context in contexts {
            for snapshot in context.windowSnapshots {
                if let wid = snapshot.windowID {
                    assignedWindowIDs.insert(wid)
                }
            }
        }

        // Available candidate windows: live and not already assigned
        let candidateWindows = liveWindows.filter { !assignedWindowIDs.contains($0.id) }

        unmatchedItems = dormant.map { entry in
            let candidates = candidateWindows.compactMap { window -> ReconcileCandidate? in
                let score = contextManager.scoreWindow(window, against: entry.snapshot.fingerprint)
                guard score > 0 else { return nil }
                return ReconcileCandidate(
                    windowID: window.id,
                    app: window.app,
                    windowTitle: window.title,
                    score: score
                )
            }
            .sorted { $0.score > $1.score }

            return ReconcileItem(
                id: entry.snapshot.id,
                contextID: entry.contextID,
                contextName: entry.contextName,
                contextColor: entry.contextColor,
                app: entry.snapshot.app,
                titlePattern: entry.snapshot.fingerprint.titlePattern,
                candidates: candidates
            )
        }
    }

    /// Sends a macOS user notification about unmatched windows.
    ///
    /// Notifications are only sent when running in a real app context.
    /// In test environments or when notifications are disabled, this is a no-op.
    /// UNUserNotificationCenter.current() crashes outside of a bundled app,
    /// so we must guard before calling it.
    private func sendReconcileNotification(count: Int) {
        guard notificationsEnabled else { return }

        // UNUserNotificationCenter requires a valid bundle ID. Verify we have one
        // before attempting to use the notification center, as calling .current()
        // will crash in SPM test runners and other non-app contexts.
        guard Bundle.main.bundleIdentifier != nil,
              Bundle.main.bundleIdentifier != "com.apple.dt.xctest.tool" else {
            return
        }

        let center = UNUserNotificationCenter.current()
        let title = configuration.notificationTitle
        let identifier = configuration.notificationIdentifier
        center.requestAuthorization(options: [.alert]) { granted, _ in
            guard granted else { return }

            let content = UNMutableNotificationContent()
            content.title = title
            content.body = "\(count) \(count == 1 ? "window needs" : "windows need") assignment"
            content.sound = nil

            let request = UNNotificationRequest(
                identifier: identifier,
                content: content,
                trigger: nil // Deliver immediately
            )
            center.add(request, withCompletionHandler: nil)
        }
    }

    // MARK: - Context Operations

    /// Creates a new context with the given name.
    public func createContext(name: String, color: String = "#007AFF") {
        do {
            try contextManager.createContext(name: name, color: color)
            syncFromManager()
        } catch {
            lastError = "Failed to create \(configuration.contextNoun): \(error.localizedDescription)"
            logger.error("Failed to create context: \(error.localizedDescription)")
        }
    }

    /// Creates a new context and returns its ID, or nil on failure.
    @discardableResult
    public func createContextReturningID(name: String, color: String = "#007AFF") -> UUID? {
        do {
            let ctx = try contextManager.createContext(name: name, color: color)
            syncFromManager()
            return ctx.id
        } catch {
            lastError = "Failed to create \(configuration.contextNoun): \(error.localizedDescription)"
            logger.error("Failed to create context: \(error.localizedDescription)")
            return nil
        }
    }

    /// Batch-adds multiple windows to a context.
    /// Returns the number of windows successfully added.
    @discardableResult
    public func addWindows(windowIDs: [UInt32], to contextID: UUID) -> Int {
        var added = 0
        for wid in windowIDs {
            do {
                try contextManager.addWindow(windowID: wid, to: contextID)
                added += 1
            } catch {
                logger.debug("Skipped window \(wid) during batch add: \(error.localizedDescription)")
            }
        }
        if added > 0 {
            syncFromManager()
            logger.info("Batch-added \(added)/\(windowIDs.count) windows to context")
        }
        return added
    }

    /// Deletes the context with the given ID.
    public func deleteContext(id: UUID) {
        do {
            try contextManager.deleteContext(id: id)
            syncFromManager()
        } catch {
            lastError = "Failed to delete context: \(error.localizedDescription)"
            logger.error("Failed to delete context: \(error.localizedDescription)")
        }
    }

    /// Renames the context with the given ID.
    public func renameContext(id: UUID, to newName: String) {
        do {
            try contextManager.renameContext(id: id, to: newName)
            syncFromManager()
        } catch {
            lastError = "Failed to rename context: \(error.localizedDescription)"
            logger.error("Failed to rename context: \(error.localizedDescription)")
        }
    }

    /// Updates the color of the context with the given ID.
    public func updateContextColor(id: UUID, to newColor: String) {
        do {
            try contextManager.updateContextColor(id: id, to: newColor)
            syncFromManager()
        } catch {
            lastError = "Failed to update context color: \(error.localizedDescription)"
            logger.error("Failed to update context color: \(error.localizedDescription)")
        }
    }

    /// Host-supplied singular noun for a context (e.g. "Hairball"), for views to
    /// de-brand their labels without reaching into the configuration directly.
    public var contextNoun: String { configuration.contextNoun }

    /// Host-supplied plural noun for contexts (e.g. "Hairballs").
    public var contextNounPlural: String { configuration.contextNounPlural }

    /// Returns the current app settings.
    public var settings: SystemWindowContextsSettings {
        settingsSetting.value
    }

    /// Updates the launch-at-login setting.
    public func setLaunchAtLogin(_ enabled: Bool) {
        var newSettings = settingsSetting.value
        newSettings.launchAtLogin = enabled
        settingsSetting.value = newSettings
    }

    /// Updates the reconcile behavior setting.
    public func setReconcileBehavior(_ behavior: ReconcileBehavior) {
        var newSettings = settingsSetting.value
        newSettings.reconcileBehavior = behavior
        settingsSetting.value = newSettings
    }

    /// Updates the show-app-in-dock setting (persistence only).
    /// The caller is responsible for applying the activation policy via
    /// AppKit; the model keeps AppKit side-effects out of persistence so it
    /// stays usable from non-app contexts (tests, previews).
    public func setShowAppInDock(_ enabled: Bool) {
        var newSettings = settingsSetting.value
        newSettings.showAppInDock = enabled
        settingsSetting.value = newSettings
    }

    /// Adds an app name to the hidden apps filter list.
    public func addHiddenApp(_ appName: String) {
        var newSettings = settingsSetting.value
        guard !newSettings.hiddenApps.contains(appName) else { return }
        newSettings.hiddenApps.append(appName)
        newSettings.hiddenApps.sort()
        settingsSetting.value = newSettings
        objectWillChange.send()
        logger.debug("Added '\(appName)' to hidden apps filter.")
    }

    /// Removes an app name from the hidden apps filter list.
    public func removeHiddenApp(_ appName: String) {
        var newSettings = settingsSetting.value
        newSettings.hiddenApps.removeAll { $0 == appName }
        settingsSetting.value = newSettings
        objectWillChange.send()
        logger.debug("Removed '\(appName)' from hidden apps filter.")
    }

    /// Switches to the context with the given ID.
    public func switchContext(to id: UUID) {
        do {
            try contextManager.switchContext(to: id)
            syncFromManager()
        } catch {
            lastError = "Failed to switch context: \(error.localizedDescription)"
            logger.error("Failed to switch context: \(error.localizedDescription)")
        }
    }

    /// Returns all currently visible windows (excluding the host app itself).
    public func listAllWindows() -> [SystemWindowInfo] {
        windowManager.listAllWindows().filter { isForeignApp($0.app) }
    }

    /// Returns the context a window belongs to, if any.
    public func context(forWindowID windowID: UInt32) -> SystemWindowContext? {
        contextManager.context(for: windowID)
    }

    /// Whether an app name is not the host app's own (and thus eligible for
    /// context management). When no `selfAppName` is configured, all apps qualify.
    private func isForeignApp(_ app: String) -> Bool {
        guard let selfAppName = configuration.selfAppName else { return true }
        return app != selfAppName
    }

    /// Adds the frontmost window to the active context.
    ///
    /// Returns true if a window was added, false if no suitable frontmost
    /// window could be found or no context is active.
    @discardableResult
    public func addFrontmostWindow() -> Bool {
        guard let activeID = activeContextID else {
            lastError = "No active context. Switch to a context first."
            return false
        }

        // Find the frontmost window that isn't owned by the host app itself
        let windows = windowManager.listWindows()
        guard let frontWindow = windows.first(where: { isForeignApp($0.app) }) else {
            lastError = "No window found to add."
            return false
        }

        do {
            try contextManager.addWindow(windowID: frontWindow.id, to: activeID)
            syncFromManager()
            return true
        } catch {
            lastError = "Failed to add window: \(error.localizedDescription)"
            logger.error("Failed to add window: \(error.localizedDescription)")
            return false
        }
    }

    /// Removes a specific window by its CGWindowID from whichever context it belongs to.
    public func removeWindow(windowID: UInt32) {
        do {
            try contextManager.removeWindow(windowID: windowID)
            syncFromManager()
        } catch {
            lastError = "Failed to remove window: \(error.localizedDescription)"
            logger.error("Failed to remove window: \(error.localizedDescription)")
        }
    }

    /// Removes a snapshot (by its stable UUID) from a specific context.
    /// Used for removing dormant windows from the Work Groups assigned list.
    public func removeSnapshot(id: UUID, from contextID: UUID) {
        do {
            try contextManager.removeDormantSnapshot(snapshotID: id, contextID: contextID)
            syncFromManager()
        } catch {
            lastError = "Failed to remove window: \(error.localizedDescription)"
            logger.error("Failed to remove snapshot: \(error.localizedDescription)")
        }
    }

    /// Removes the frontmost window from its context.
    ///
    /// Returns true if a window was removed.
    @discardableResult
    public func removeFrontmostWindow() -> Bool {
        let windows = windowManager.listWindows()
        guard let frontWindow = windows.first(where: { isForeignApp($0.app) }) else {
            lastError = "No window found to remove."
            return false
        }

        // Check if this window is assigned to any context
        guard contextManager.context(for: frontWindow.id) != nil else {
            lastError = "This window is not assigned to any context."
            return false
        }

        do {
            try contextManager.removeWindow(windowID: frontWindow.id)
            syncFromManager()
            return true
        } catch {
            lastError = "Failed to remove window: \(error.localizedDescription)"
            logger.error("Failed to remove window: \(error.localizedDescription)")
            return false
        }
    }

    /// Switches to the next context in the list, wrapping around to the first.
    ///
    /// If no context is active, switches to the first context.
    /// If there are fewer than 2 contexts, this is a no-op.
    public func switchToNextContext() {
        guard contexts.count >= 2 else { return }

        if let activeID = activeContextID,
           let currentIndex = contexts.firstIndex(where: { $0.id == activeID }) {
            let nextIndex = (currentIndex + 1) % contexts.count
            switchContext(to: contexts[nextIndex].id)
        } else if let first = contexts.first {
            switchContext(to: first.id)
        }
    }

    /// Switches to the previous context in the list, wrapping around to the last.
    ///
    /// If no context is active, switches to the last context.
    /// If there are fewer than 2 contexts, this is a no-op.
    public func switchToPreviousContext() {
        guard contexts.count >= 2 else { return }

        if let activeID = activeContextID,
           let currentIndex = contexts.firstIndex(where: { $0.id == activeID }) {
            let prevIndex = (currentIndex - 1 + contexts.count) % contexts.count
            switchContext(to: contexts[prevIndex].id)
        } else if let last = contexts.last {
            switchContext(to: last.id)
        }
    }

    /// Toggles the context picker popup visibility.
    public func toggleContextPicker() {
        showContextPicker.toggle()
    }

    /// Dismisses the context picker popup.
    public func dismissContextPicker() {
        showContextPicker = false
    }

    /// Returns the active context, if any.
    public var activeContext: SystemWindowContext? {
        guard let id = activeContextID else { return nil }
        return contexts.first(where: { $0.id == id })
    }

    // MARK: - Window Observation

    /// Starts the window observer to monitor window lifecycle events.
    ///
    /// Call this once during app startup, after loadState(). The observer
    /// subscribes to AX notifications and NSWorkspace events to detect
    /// window creation, destruction, title changes, and app lifecycle.
    public func startWindowObservation() {
        guard observationEnabled else {
            logger.debug("Window observation disabled (test environment).")
            return
        }

        let observer = SystemWindowObserver(windowManager: windowManager)
        observer.delegate = self
        observer.startObserving()
        self.windowObserver = observer
    }

    /// Stops the window observer.
    public func stopWindowObservation() {
        windowObserver?.stopObserving()
        windowObserver = nil
    }

    // MARK: - Private

    /// Syncs published properties from the underlying SystemWindowContextManager.
    private func syncFromManager() {
        contexts = contextManager.contexts
        activeContextID = contextManager.activeContextID
        customHeuristicRules = contextManager.customHeuristicRules
    }
}

extension SystemWindowContextsModel: Loggable {
    public static nonisolated let logger = makeLogger()
}

// MARK: - SystemWindowObserverDelegate

extension SystemWindowContextsModel: SystemWindowObserverDelegate {

    public nonisolated func windowDestroyed(windowID: UInt32) {
        Task { @MainActor in
            let snapshot = contextManager.markWindowDormant(windowID: windowID)
            if let snapshot = snapshot {
                logger.info("Window \(windowID) (\(snapshot.app)) marked dormant, fingerprint preserved.")
            }
            syncFromManager()
        }
    }

    public nonisolated func windowCreated(window: SystemWindowInfo) {
        Task { @MainActor in
            // First try dormant snapshot matching
            if let contextID = contextManager.checkNewWindowForAutoAssignment(window) {
                let contextName = contexts.first(where: { $0.id == contextID })?.name ?? "unknown"
                logger.info(
                    "Auto-assigned window \(window.id) (\(window.app)) to context '\(contextName)' (dormant match)."
                )
            }
            // Then try custom heuristic rules for auto-assignment
            else if let contextID = contextManager.checkCustomRulesForAutoAssignment(window) {
                let contextName = contexts.first(where: { $0.id == contextID })?.name ?? "unknown"
                logger.info(
                    "Auto-assigned window \(window.id) (\(window.app)) to context '\(contextName)' (custom rule)."
                )
            }
            syncFromManager()
        }
    }

    public nonisolated func windowTitleChanged(windowID: UInt32, newTitle: String) {
        Task { @MainActor in
            let updated = contextManager.updateWindowTitle(windowID: windowID, newTitle: newTitle)
            if updated {
                syncFromManager()
            }
        }
    }

    public nonisolated func appTerminated(appName: String, pid: Int32) {
        Task { @MainActor in
            let count = contextManager.markAppWindowsDormant(appName: appName)
            if count > 0 {
                logger.info("App '\(appName)' terminated, \(count) windows marked dormant.")
            }
            syncFromManager()
        }
    }

    public nonisolated func appLaunched(appName: String, pid: Int32) {
        Task { @MainActor in
            let count = contextManager.reMatchDormantWindowsForApp(appName: appName)
            if count > 0 {
                logger.info("App '\(appName)' launched, re-matched \(count) dormant windows.")
            }
            syncFromManager()
        }
    }
}

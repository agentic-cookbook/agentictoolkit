import AgenticToolkitCore
import AppKit
import ApplicationServices
import Foundation
import os.log

/// Protocol for receiving system window observation events.
///
/// Decouples the observer from concrete orchestration implementations,
/// making it testable.
public protocol SystemWindowObserverDelegate: AnyObject {
    /// Called when a window is destroyed (closed).
    func windowDestroyed(windowID: UInt32)

    /// Called when a new window is created.
    func windowCreated(window: SystemWindowInfo)

    /// Called when a window's title changes.
    func windowTitleChanged(windowID: UInt32, newTitle: String)

    /// Called when an application terminates.
    func appTerminated(appName: String, pid: Int32)

    /// Called when an application launches.
    func appLaunched(appName: String, pid: Int32)
}

/// Observes window lifecycle events using AX notifications and NSWorkspace.
///
/// SystemWindowObserver subscribes to:
/// - NSWorkspace notifications: didLaunchApplication, didTerminateApplication
/// - AXObserver notifications per app: windowCreated, uiElementDestroyed, titleChanged
///
/// Concurrency: every access path is confined to the main run loop — AX
/// observers are added to `CFRunLoopGetMain()`, NSWorkspace observers use the
/// `.main` queue, and all internal hops go through `DispatchQueue.main`. The
/// type is therefore `@unchecked Sendable`; this invariant is what keeps the
/// unchecked conformance sound.
public final class SystemWindowObserver: @unchecked Sendable, Loggable {

    public static nonisolated let logger = makeLogger()

    /// The delegate that receives window events.
    public weak var delegate: SystemWindowObserverDelegate?

    /// The window manager used for looking up window info.
    private let windowManager: SystemWindowControlling

    /// Active AX observers keyed by PID. Each observer monitors one application.
    private var axObservers: [Int32: AXObserver] = [:]

    /// Tracks known window IDs to detect destroyed windows.
    /// Maps PID to the set of window IDs for that application.
    private var knownWindowsByPID: [Int32: Set<UInt32>] = [:]

    /// NSWorkspace notification observers.
    private var launchObserver: NSObjectProtocol?
    private var terminateObserver: NSObjectProtocol?

    /// Whether the observer is currently active.
    public private(set) var isObserving: Bool = false

    // MARK: - Initialization

    /// Creates a SystemWindowObserver with the given window manager.
    ///
    /// - Parameter windowManager: Used to enumerate windows for new/destroyed detection.
    public init(windowManager: SystemWindowControlling) {
        self.windowManager = windowManager
    }

    deinit {
        stopObserving()
    }

    // MARK: - Start / Stop

    /// Starts observing window and application events.
    public func startObserving() {
        guard !isObserving else { return }
        isObserving = true

        // Take a snapshot of all current windows
        refreshKnownWindows()

        // Subscribe to NSWorkspace application notifications
        let workspace = NSWorkspace.shared
        let center = workspace.notificationCenter

        launchObserver = center.addObserver(
            forName: NSWorkspace.didLaunchApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleAppLaunched(notification)
        }

        terminateObserver = center.addObserver(
            forName: NSWorkspace.didTerminateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleAppTerminated(notification)
        }

        // Create AX observers for all running apps
        for app in workspace.runningApplications {
            guard let name = app.localizedName, !name.isEmpty else { continue }
            guard app.activationPolicy == .regular else { continue }
            createAXObserver(for: app.processIdentifier, appName: name)
        }

        Self.logger.info("SystemWindowObserver started, monitoring \(self.axObservers.count) applications")
    }

    /// Stops observing all events and cleans up observers.
    public func stopObserving() {
        guard isObserving else { return }
        isObserving = false

        // Remove NSWorkspace observers
        let center = NSWorkspace.shared.notificationCenter
        if let obs = launchObserver {
            center.removeObserver(obs)
            launchObserver = nil
        }
        if let obs = terminateObserver {
            center.removeObserver(obs)
            terminateObserver = nil
        }

        // Remove all AX observers
        for (pid, observer) in axObservers {
            removeAXObserver(observer, pid: pid)
        }
        axObservers.removeAll()
        knownWindowsByPID.removeAll()

        Self.logger.info("SystemWindowObserver stopped")
    }

    /// Refreshes the known windows snapshot from the window manager.
    public func refreshKnownWindows() {
        let allWindows = windowManager.listAllWindows()
        knownWindowsByPID.removeAll()
        for window in allWindows {
            knownWindowsByPID[window.pid, default: []].insert(window.id)
        }
    }

    // MARK: - NSWorkspace Event Handlers

    /// Handles app launch notification.
    private func handleAppLaunched(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
              let appName = app.localizedName else {
            return
        }

        let pid = app.processIdentifier

        Self.logger.info("App launched: \(appName) (PID \(pid))")

        // Create an AX observer for the new app (with a small delay to let windows appear)
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            guard let self = self, self.isObserving else { return }
            self.createAXObserver(for: pid, appName: appName)
            self.refreshKnownWindows()
            self.delegate?.appLaunched(appName: appName, pid: pid)
        }
    }

    /// Handles app termination notification.
    private func handleAppTerminated(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication,
              let appName = app.localizedName else {
            return
        }

        let pid = app.processIdentifier

        Self.logger.info("App terminated: \(appName) (PID \(pid))")

        // Clean up the AX observer for this app
        if let observer = axObservers.removeValue(forKey: pid) {
            removeAXObserver(observer, pid: pid)
        }
        knownWindowsByPID.removeValue(forKey: pid)

        delegate?.appTerminated(appName: appName, pid: pid)
    }

    // MARK: - AX Observer Management

    /// Creates an AXObserver for the given PID and subscribes to window events.
    private func createAXObserver(for pid: Int32, appName: String) {
        guard axObservers[pid] == nil else { return }

        var observer: AXObserver?
        let result = AXObserverCreate(pid, axObserverCallback, &observer)
        guard result == .success, let axObserver = observer else {
            // AXObserver creation can fail if the app doesn't support AX
            return
        }

        let appElement = AXUIElementCreateApplication(pid)

        // Subscribe to window created notification on the app element
        AXObserverAddNotification(
            axObserver,
            appElement,
            kAXWindowCreatedNotification as CFString,
            Unmanaged.passUnretained(self).toOpaque()
        )

        // Subscribe to focused window changed to track title changes
        AXObserverAddNotification(
            axObserver,
            appElement,
            kAXFocusedWindowChangedNotification as CFString,
            Unmanaged.passUnretained(self).toOpaque()
        )

        // Subscribe to notifications on existing windows
        let axWindows = SystemWindowAXHelper.axWindows(forPID: pid)
        for axWindow in axWindows {
            subscribeToWindowNotifications(axObserver, window: axWindow)
        }

        // Add the observer to the main run loop
        CFRunLoopAddSource(
            CFRunLoopGetMain(),
            AXObserverGetRunLoopSource(axObserver),
            .defaultMode
        )

        axObservers[pid] = axObserver
    }

    /// Subscribes to destruction and title change notifications for a single window.
    private func subscribeToWindowNotifications(_ observer: AXObserver, window: AXUIElement) {
        let refcon = Unmanaged.passUnretained(self).toOpaque()

        AXObserverAddNotification(
            observer,
            window,
            kAXUIElementDestroyedNotification as CFString,
            refcon
        )

        AXObserverAddNotification(
            observer,
            window,
            kAXTitleChangedNotification as CFString,
            refcon
        )
    }

    /// Removes an AX observer from the run loop.
    private func removeAXObserver(_ observer: AXObserver, pid: Int32) {
        CFRunLoopRemoveSource(
            CFRunLoopGetMain(),
            AXObserverGetRunLoopSource(observer),
            .defaultMode
        )
    }

    // MARK: - AX Notification Handling

    /// Called by the C-level AX observer callback. Dispatches to the appropriate handler.
    func handleAXNotification(
        observer: AXObserver,
        element: AXUIElement,
        notification: CFString
    ) {
        let notifName = notification as String

        switch notifName {
        case kAXWindowCreatedNotification:
            handleWindowCreated(element: element, observer: observer)

        case kAXUIElementDestroyedNotification:
            handleWindowDestroyed(element: element)

        case kAXTitleChangedNotification:
            handleTitleChanged(element: element)

        case kAXFocusedWindowChangedNotification:
            handleFocusedWindowChanged(element: element, observer: observer)

        default:
            break
        }
    }

    /// Handles a new window being created.
    private func handleWindowCreated(element: AXUIElement, observer: AXObserver) {
        // Subscribe to notifications on the new window
        subscribeToWindowNotifications(observer, window: element)

        // Capture the baseline NOW, scoped to the owning app. Reading it inside the
        // delayed block instead would race a synchronous destroy handler's
        // refreshKnownWindows() (TOCTOU), hiding the new window from the diff. Scoping
        // to the PID also avoids re-flattening every app's windows on each event.
        var pid: pid_t = 0
        let havePID = AXUIElementGetPid(element, &pid) == .success
        let previousIDs: Set<UInt32> = havePID
            ? (knownWindowsByPID[pid] ?? [])
            : Set(knownWindowsByPID.values.flatMap { $0 })

        // Give the window a moment to settle (title may not be set yet)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self = self, self.isObserving else { return }

            // Refresh and detect the new window
            let currentWindows = self.windowManager.listAllWindows()
            let scoped = havePID ? currentWindows.filter { $0.pid == pid } : currentWindows
            let currentIDs = Set(scoped.map(\.id))
            let newIDs = currentIDs.subtracting(previousIDs)

            self.refreshKnownWindows()

            for window in scoped where newIDs.contains(window.id) {
                Self.logger.info("Window created: \(window.app) — '\(window.title)' (ID \(window.id))")
                self.delegate?.windowCreated(window: window)
            }
        }
    }

    /// Handles a window being destroyed.
    private func handleWindowDestroyed(element: AXUIElement) {
        // We can't query the destroyed element for its properties, so we
        // detect which window ID disappeared by comparing current state
        // against our known set.
        let currentWindows = windowManager.listAllWindows()
        let currentIDs = Set(currentWindows.map(\.id))
        let previousIDs = Set(knownWindowsByPID.values.flatMap { $0 })
        let destroyedIDs = previousIDs.subtracting(currentIDs)

        refreshKnownWindows()

        for windowID in destroyedIDs {
            Self.logger.info("Window destroyed: ID \(windowID)")
            delegate?.windowDestroyed(windowID: windowID)
        }
    }

    /// Handles a window title change.
    private func handleTitleChanged(element: AXUIElement) {
        guard let newTitle = SystemWindowAXHelper.title(of: element) else { return }

        guard let position = SystemWindowAXHelper.position(of: element),
              let size = SystemWindowAXHelper.size(of: element) else {
            return
        }

        // Scope the match to the element's owning app, so a same-geometry window of a
        // DIFFERENT app can never receive this title. (Matching is still by position
        // and size, since the title just changed.)
        var pid: pid_t = 0
        let havePID = AXUIElementGetPid(element, &pid) == .success
        let candidates = windowManager.listAllWindows().filter { !havePID || $0.pid == pid }

        let matchedWindow = candidates.first { window in
            abs(window.frame.origin.x - position.x) < 2
            && abs(window.frame.origin.y - position.y) < 2
            && abs(window.frame.size.width - size.width) < 2
            && abs(window.frame.size.height - size.height) < 2
        }

        if let window = matchedWindow {
            Self.logger.debug("Title changed: \(window.app) — '\(newTitle)' (ID \(window.id))")
            delegate?.windowTitleChanged(windowID: window.id, newTitle: newTitle)
        }
    }

    /// Handles focused window changed -- subscribe to the new window's notifications.
    private func handleFocusedWindowChanged(element: AXUIElement, observer: AXObserver) {
        // The element here is the application element, not the window.
        // Get the focused window and subscribe to its events.
        var focusedWindowRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(
            element,
            kAXFocusedWindowAttribute as CFString,
            &focusedWindowRef
        )

        guard result == .success, let focusedWindowRef,
              CFGetTypeID(focusedWindowRef) == AXUIElementGetTypeID() else { return }

        // Subscribe to notifications on the focused window (in case it's new).
        // AXObserverAddNotification deduplicates by (element, notification), so this does
        // not accumulate duplicate registrations; an app's registrations are all released
        // when its AXObserver is dropped in stopObserving()/handleAppTerminated.
        // Safe: the CFGetTypeID check above guarantees this is an AXUIElement.
        // swiftlint:disable:next force_cast
        let focusedWindow = focusedWindowRef as! AXUIElement
        subscribeToWindowNotifications(observer, window: focusedWindow)
    }
}

// MARK: - AX Observer C Callback

/// C-level callback for AXObserver notifications.
///
/// AXObserverCreate requires a C-function-pointer callback. This function
/// bridges to the SystemWindowObserver instance via the refcon (context pointer).
private func axObserverCallback(
    observer: AXObserver,
    element: AXUIElement,
    notification: CFString,
    refcon: UnsafeMutableRawPointer?
) {
    guard let refcon = refcon else { return }
    let windowObserver = Unmanaged<SystemWindowObserver>.fromOpaque(refcon).takeUnretainedValue()
    windowObserver.handleAXNotification(
        observer: observer,
        element: element,
        notification: notification
    )
}

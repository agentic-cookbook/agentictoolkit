import AppKit
import Combine
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import os

/// A single window discovered from the system window list.
public struct DiscoveredWindow: Identifiable {
    /// The window's CGWindowID — used to focus the window via the engine.
    public let id: CGWindowID
    public let title: String
    public let pid: pid_t
    /// Whether this window's title matches the session's project name.
    public let isMatch: Bool
}

/// A running application and its discoverable windows.
public struct DiscoveredApp: Identifiable {
    public let id: pid_t
    public let name: String
    public let icon: NSImage?
    public let windows: [DiscoveredWindow]
    /// Whether any window in this app matches the session.
    public var hasMatch: Bool { windows.contains { $0.isMatch } }
}

/// Discovers windows via the SystemWindow engine and groups them by app, including
/// minimized and off-screen windows so the user can bring any of them back.
///
/// Works with Accessibility permission alone: when CGWindowListCopyWindowInfo omits a
/// title (it does for other apps without Screen Recording permission), the engine
/// backfills it via the Accessibility API.
public final class WindowDiscoveryViewModel: ObservableObject, @unchecked Sendable {

    // MARK: - Published State

    @Published public var isLoading = true
    @Published public var apps: [DiscoveredApp] = []
    @Published public var accessibilityDenied = false

    // MARK: - Properties

    public let session: SessionWatcher.SessionWatcherSession

    /// Called after the user selects and activates a window so the panel can close.
    public var onWindowActivated: (() -> Void)?

    /// The engine used to enumerate and focus other apps' windows.
    private let windowManager = SystemWindowManager()

    // MARK: - Initialization

    public init(session: SessionWatcher.SessionWatcherSession) {
        self.session = session
    }

    // MARK: - Discovery

    /// Snapshot of a running application's metadata, captured on the main thread.
    private struct AppSnapshot {
        let pid: pid_t
        let name: String
        let icon: NSImage?
    }

    /// Enumerates all windows asynchronously. Call from onAppear.
    public func discoverWindows() {
        isLoading = true
        accessibilityDenied = false

        guard SystemAccessibilityPermission.isGranted else {
            isLoading = false
            accessibilityDenied = true
            return
        }

        // Snapshot app metadata on the main thread (NSWorkspace/NSRunningApplication
        // are main-thread APIs). Only regular apps are eligible for discovery.
        let appSnapshots: [AppSnapshot] = NSWorkspace.shared.runningApplications.compactMap { app in
            guard app.activationPolicy == .regular else { return nil }
            return AppSnapshot(pid: app.processIdentifier, name: app.localizedName ?? "Unknown", icon: app.icon)
        }
        let projectName = session.projectName

        // Window enumeration on a background thread.
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            let results = self.enumerateWindows(for: appSnapshots, matching: projectName)
            DispatchQueue.main.async {
                self.apps = results
                self.isLoading = false
            }
        }
    }

    /// Groups the engine's windows by owning app, applies heuristic matching, and sorts.
    /// Restricted to the snapshotted (regular) apps, with their icons. Uses the full
    /// window list (including minimized/off-screen windows) so any window is reachable.
    private func enumerateWindows(for snapshots: [AppSnapshot], matching projectName: String) -> [DiscoveredApp] {
        let snapshotsByPID = Dictionary(snapshots.map { ($0.pid, $0) }, uniquingKeysWith: { first, _ in first })

        var windowsByPID: [pid_t: [DiscoveredWindow]] = [:]
        for window in windowManager.listAllWindows() where !window.title.isEmpty {
            // Keep only windows owned by a regular app we snapshotted.
            guard snapshotsByPID[window.pid] != nil else { continue }
            windowsByPID[window.pid, default: []].append(DiscoveredWindow(
                id: window.id,
                title: window.title,
                pid: window.pid,
                isMatch: Self.matches(window: window, projectName: projectName)
            ))
        }

        let result: [DiscoveredApp] = windowsByPID.compactMap { pid, windows in
            guard let snapshot = snapshotsByPID[pid] else { return nil }
            return DiscoveredApp(id: pid, name: snapshot.name, icon: snapshot.icon, windows: windows)
        }

        // Sort: apps with matches first, then alphabetical.
        return result.sorted { lhs, rhs in
            if lhs.hasMatch != rhs.hasMatch { return lhs.hasMatch }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
    }

    /// Heuristic match: extract the app-specific title pattern (Xcode/Warp/VSCode/…)
    /// and test it against the session project name, falling back to the raw title so
    /// existing substring matches still hold.
    static func matches(window: SystemWindowInfo, projectName: String) -> Bool {
        guard !projectName.isEmpty, projectName != "Unknown" else { return false }
        let pattern = HeuristicRegistry.shared.heuristic(for: window.app)?
            .extractPattern(from: window.title) ?? window.title
        return pattern.localizedCaseInsensitiveContains(projectName)
            || window.title.localizedCaseInsensitiveContains(projectName)
    }

    // MARK: - Activation

    /// Activates the selected window and its owning app via the engine.
    ///
    /// Only dismisses the panel when the focus actually succeeds; on failure it logs and
    /// leaves the panel open so the user can retry or pick another window, rather than
    /// silently closing as if it worked.
    public func activateWindow(_ window: DiscoveredWindow) {
        logger.info("WindowDiscovery: activating '\(window.title, privacy: .public)' (PID \(window.pid))")
        do {
            try windowManager.focus(windowID: window.id)
            onWindowActivated?()
        } catch {
            let reason = error.localizedDescription
            logger.error("WindowDiscovery: focus failed (PID \(window.pid)): \(reason, privacy: .public)")
        }
    }

    public func openAccessibilitySettings() {
        SystemAccessibilityPermission.request()
    }
}

extension WindowDiscoveryViewModel: Loggable {
    public static nonisolated let logger = makeLogger()
}

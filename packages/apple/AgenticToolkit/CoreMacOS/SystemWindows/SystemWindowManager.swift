import AgenticToolkitCore
import AppKit
import ApplicationServices
import CoreGraphics
import Foundation

/// Enumerates and manages other applications' windows using
/// CGWindowListCopyWindowInfo and manipulates them via AXUIElement.
///
/// CGWindowListCopyWindowInfo is a public API that does not require
/// Accessibility permission — it returns information about all visible windows.
/// Window manipulation (move, resize, focus) requires Accessibility permission.
public final class SystemWindowManager: SystemWindowControlling {

    /// Apps whose windows should be excluded from enumeration.
    /// These are system-level processes whose windows are not user-managed.
    public static let excludedApps: Set<String> = [
        "Window Server",
        "WindowManager",
        "Dock",
        "Control Center",
        "Notification Center",
        "SystemUIServer"
    ]

    public init() {}

    /// Returns information about all user-visible windows.
    public func listWindows() -> [SystemWindowInfo] {
        guard let windowList = CGWindowListCopyWindowInfo(
            [.optionOnScreenOnly, .excludeDesktopElements],
            kCGNullWindowID
        ) as? [[String: Any]] else {
            return []
        }

        return backfillTitles(windowList.compactMap { parseWindow(from: $0) })
    }

    /// Returns information about all windows, including off-screen (minimized
    /// or parked) windows.
    public func listAllWindows() -> [SystemWindowInfo] {
        guard let windowList = CGWindowListCopyWindowInfo(
            [.optionAll, .excludeDesktopElements],
            kCGNullWindowID
        ) as? [[String: Any]] else {
            return []
        }

        return backfillTitles(windowList.compactMap { parseWindow(from: $0) })
    }

    // MARK: - Window Manipulation (requires Accessibility permission)

    /// Moves a window to the specified position.
    public func move(windowID: UInt32, to point: CGPoint) throws {
        let (axElement, _) = try resolveAXElement(for: windowID)

        let result = SystemWindowAXHelper.setPosition(of: axElement, to: point)
        guard result == .success else {
            throw SystemWindowControlError.attributeSetFailed(
                attribute: kAXPositionAttribute,
                axError: result.rawValue
            )
        }
    }

    /// Resizes a window to the specified size.
    public func resize(windowID: UInt32, to size: CGSize) throws {
        let (axElement, _) = try resolveAXElement(for: windowID)

        let result = SystemWindowAXHelper.setSize(of: axElement, to: size)
        guard result == .success else {
            throw SystemWindowControlError.attributeSetFailed(
                attribute: kAXSizeAttribute,
                axError: result.rawValue
            )
        }
    }

    /// Brings a window to the front and focuses its owning application.
    public func focus(windowID: UInt32) throws {
        let (axElement, windowInfo) = try resolveAXElement(for: windowID)

        // Raise the window within the app
        let raiseResult = SystemWindowAXHelper.raise(axElement)
        if raiseResult != .success {
            throw SystemWindowControlError.attributeSetFailed(
                attribute: kAXRaiseAction,
                axError: raiseResult.rawValue
            )
        }

        // Activate the owning application to bring it to the front
        guard let app = NSRunningApplication(processIdentifier: windowInfo.pid) else {
            throw SystemWindowControlError.activationFailed(
                app: windowInfo.app,
                pid: windowInfo.pid
            )
        }

        let activated = app.activate()
        if !activated {
            throw SystemWindowControlError.activationFailed(
                app: windowInfo.app,
                pid: windowInfo.pid
            )
        }
    }

    /// Moves and resizes a window to the specified frame in a single operation.
    public func setFrame(windowID: UInt32, to frame: CGRect) throws {
        let (axElement, _) = try resolveAXElement(for: windowID)

        let posResult = SystemWindowAXHelper.setPosition(of: axElement, to: frame.origin)
        guard posResult == .success else {
            throw SystemWindowControlError.attributeSetFailed(
                attribute: kAXPositionAttribute,
                axError: posResult.rawValue
            )
        }

        let sizeResult = SystemWindowAXHelper.setSize(of: axElement, to: frame.size)
        guard sizeResult == .success else {
            throw SystemWindowControlError.attributeSetFailed(
                attribute: kAXSizeAttribute,
                axError: sizeResult.rawValue
            )
        }
    }

    /// Returns the AXUIElement for a given CGWindowID, along with its window info.
    public func axElement(for windowID: UInt32) throws -> (AXUIElement, SystemWindowInfo) {
        try resolveAXElement(for: windowID)
    }

    // MARK: - Private (AX Resolution)

    /// Resolves a CGWindowID to its AXUIElement and window info.
    private func resolveAXElement(
        for windowID: UInt32
    ) throws -> (AXUIElement, SystemWindowInfo) {
        // Find the window in the CG window list
        let allWindows = listAllWindows()
        guard let windowInfo = allWindows.first(where: { $0.id == windowID }) else {
            throw SystemWindowControlError.windowNotFound(windowID: windowID)
        }

        // Get the AXUIElement for this window
        guard let axElement = SystemWindowAXHelper.axElement(
            for: windowID,
            windowInfo: windowInfo
        ) else {
            throw SystemWindowControlError.accessibilityNotAvailable(
                app: windowInfo.app,
                pid: windowInfo.pid
            )
        }

        return (axElement, windowInfo)
    }

    // MARK: - Private

    /// Builds a `SystemWindowInfo` from a CGWindowListCopyWindowInfo dictionary,
    /// computing the real display from the window center. Applies no policy filtering
    /// (callers filter as needed); returns nil only if required fields are missing.
    ///
    /// Shared with `SystemWindowAXHelper.lookupWindowInfo` so both code paths agree on
    /// field extraction and on the `display` value (previously the AX path hardcoded
    /// the main display).
    static func windowInfo(from dict: [String: Any]) -> SystemWindowInfo? {
        guard
            let windowID = dict[kCGWindowNumber as String] as? UInt32,
            let ownerPID = dict[kCGWindowOwnerPID as String] as? Int32,
            let layer = dict[kCGWindowLayer as String] as? Int32,
            let boundsDict = dict[kCGWindowBounds as String] as? [String: CGFloat]
        else {
            return nil
        }

        let ownerName = dict[kCGWindowOwnerName as String] as? String ?? ""
        let title = dict[kCGWindowName as String] as? String ?? ""
        let isOnScreen = dict[kCGWindowIsOnscreen as String] as? Bool ?? false

        let originX = boundsDict["X"] ?? 0
        let originY = boundsDict["Y"] ?? 0
        let width = boundsDict["Width"] ?? 0
        let height = boundsDict["Height"] ?? 0
        let frame = CGRect(x: originX, y: originY, width: width, height: height)

        return SystemWindowInfo(
            id: windowID,
            app: ownerName,
            pid: ownerPID,
            title: title,
            frame: frame,
            display: displayForPoint(CGPoint(x: frame.midX, y: frame.midY)),
            isOnScreen: isOnScreen,
            layer: layer
        )
    }

    /// Parses a window dict and applies enumeration policy (normal layer, not an
    /// excluded system app, non-zero size), or returns nil if it should be excluded.
    private func parseWindow(from dict: [String: Any]) -> SystemWindowInfo? {
        guard let info = Self.windowInfo(from: dict) else { return nil }

        // Only normal-layer windows (layer 0); skip system UI surfaces.
        guard info.layer == 0 else { return nil }
        // Skip excluded system apps.
        guard !Self.excludedApps.contains(info.app) else { return nil }
        // Skip zero-size windows (status items, invisible overlays).
        guard info.frame.width > 0, info.frame.height > 0 else { return nil }

        return info
    }

    /// Returns the display ID for the display containing the given point.
    /// Falls back to the main display if no match is found.
    static func displayForPoint(_ point: CGPoint) -> UInt32 {
        var displayID: CGDirectDisplayID = 0
        var matchingDisplayCount: UInt32 = 0

        let result = CGGetDisplaysWithPoint(point, 1, &displayID, &matchingDisplayCount)

        if result == .success && matchingDisplayCount > 0 {
            return displayID
        }
        return CGMainDisplayID()
    }

    // MARK: - Title Backfill

    /// Backfills empty titles via Accessibility.
    ///
    /// `CGWindowListCopyWindowInfo` omits the window title (`kCGWindowName`) without
    /// Screen Recording permission, but the title is available via `kAXTitle` with
    /// Accessibility alone. This keeps titles working under the app's Accessibility-only
    /// permission model. Cost is one AX enumeration per owning PID that needs a title,
    /// incurred only when CG returned empty titles (near-zero when Screen Recording is
    /// granted).
    private func backfillTitles(_ windows: [SystemWindowInfo]) -> [SystemWindowInfo] {
        let pidsNeedingTitles = Set(windows.filter { $0.title.isEmpty }.map(\.pid))
        guard !pidsNeedingTitles.isEmpty else { return windows }

        var axWindowsByPID: [Int32: [AXUIElement]] = [:]
        for pid in pidsNeedingTitles {
            axWindowsByPID[pid] = SystemWindowAXHelper.axWindows(forPID: pid)
        }

        return windows.map { window in
            guard window.title.isEmpty,
                  let axWindows = axWindowsByPID[window.pid],
                  let title = Self.axTitle(forFrame: window.frame, in: axWindows),
                  !title.isEmpty
            else {
                return window
            }
            return window.withTitle(title)
        }
    }

    /// Finds the AX window whose frame matches `frame` (within tolerance) and returns
    /// its title, or nil if no match.
    private static func axTitle(forFrame frame: CGRect, in axWindows: [AXUIElement]) -> String? {
        for axWindow in axWindows {
            guard let position = SystemWindowAXHelper.position(of: axWindow),
                  let size = SystemWindowAXHelper.size(of: axWindow) else { continue }
            if abs(position.x - frame.origin.x) < 2, abs(position.y - frame.origin.y) < 2,
               abs(size.width - frame.size.width) < 2, abs(size.height - frame.size.height) < 2 {
                return SystemWindowAXHelper.title(of: axWindow)
            }
        }
        return nil
    }
}

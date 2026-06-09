import AgenticToolkitCore
import ApplicationServices
import CoreGraphics
import Foundation

/// Bridges CGWindowID to AXUIElement by matching windows through PID and window
/// properties (title, position, size).
///
/// CGWindowListCopyWindowInfo provides window IDs and owning PIDs, but AXUIElement
/// has no direct constructor from a CGWindowID. Instead, we:
/// 1. Look up the window's PID from CGWindowListCopyWindowInfo
/// 2. Create an AXUIElement for the application (from PID)
/// 3. Enumerate the app's AX windows
/// 4. Match by title, position, and size to find the correct AXUIElement
public enum SystemWindowAXHelper {

    /// Returns the AXUIElement corresponding to the given CGWindowID.
    ///
    /// - Parameter windowID: The CGWindowID to look up.
    /// - Parameter windowInfo: Optional pre-fetched window info. If nil, a fresh
    ///   CGWindowListCopyWindowInfo call is made to find the window's PID and title.
    /// - Returns: The matching AXUIElement, or nil if no match is found.
    public static func axElement(
        for windowID: UInt32,
        windowInfo: SystemWindowInfo? = nil
    ) -> AXUIElement? {
        // Get window info from CG if not provided
        let info: SystemWindowInfo
        if let windowInfo {
            info = windowInfo
        } else {
            guard let looked = lookupWindowInfo(windowID: windowID) else {
                return nil
            }
            info = looked
        }

        let appElement = AXUIElementCreateApplication(info.pid)

        // Get the app's windows via AX
        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(
            appElement,
            kAXWindowsAttribute as CFString,
            &windowsRef
        )
        guard result == .success,
              let axWindows = windowsRef as? [AXUIElement]
        else {
            return nil
        }

        // Match by title, position, and size
        return bestMatch(
            axWindows: axWindows,
            title: info.title,
            frame: info.frame
        )
    }

    /// Returns all AXUIElement windows for the application that owns the given PID.
    public static func axWindows(forPID pid: Int32) -> [AXUIElement] {
        let appElement = AXUIElementCreateApplication(pid)

        var windowsRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(
            appElement,
            kAXWindowsAttribute as CFString,
            &windowsRef
        )
        guard result == .success,
              let axWindows = windowsRef as? [AXUIElement]
        else {
            return []
        }

        return axWindows
    }

    // MARK: - AX Attribute Helpers

    /// Gets the title of an AXUIElement window.
    public static func title(of element: AXUIElement) -> String? {
        var titleRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(
            element,
            kAXTitleAttribute as CFString,
            &titleRef
        )
        guard result == .success else { return nil }
        return titleRef as? String
    }

    /// Gets the position of an AXUIElement window.
    public static func position(of element: AXUIElement) -> CGPoint? {
        var positionRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(
            element,
            kAXPositionAttribute as CFString,
            &positionRef
        )
        guard result == .success, let positionRef,
              CFGetTypeID(positionRef) == AXValueGetTypeID() else {
            return nil
        }

        var point = CGPoint.zero
        // Safe: the CFGetTypeID check above guarantees this is an AXValue.
        // swiftlint:disable:next force_cast
        guard AXValueGetValue(positionRef as! AXValue, .cgPoint, &point) else {
            return nil
        }
        return point
    }

    /// Gets the size of an AXUIElement window.
    public static func size(of element: AXUIElement) -> CGSize? {
        var sizeRef: CFTypeRef?
        let result = AXUIElementCopyAttributeValue(
            element,
            kAXSizeAttribute as CFString,
            &sizeRef
        )
        guard result == .success, let sizeRef,
              CFGetTypeID(sizeRef) == AXValueGetTypeID() else {
            return nil
        }

        var size = CGSize.zero
        // Safe: the CFGetTypeID check above guarantees this is an AXValue.
        // swiftlint:disable:next force_cast
        guard AXValueGetValue(sizeRef as! AXValue, .cgSize, &size) else {
            return nil
        }
        return size
    }

    /// Sets the position of an AXUIElement window.
    ///
    /// - Returns: The AXError code (.success on success).
    @discardableResult
    public static func setPosition(of element: AXUIElement, to point: CGPoint) -> AXError {
        var mutablePoint = point
        guard let value = AXValueCreate(.cgPoint, &mutablePoint) else {
            return .failure
        }
        return AXUIElementSetAttributeValue(
            element,
            kAXPositionAttribute as CFString,
            value
        )
    }

    /// Sets the size of an AXUIElement window.
    ///
    /// - Returns: The AXError code (.success on success).
    @discardableResult
    public static func setSize(of element: AXUIElement, to size: CGSize) -> AXError {
        var mutableSize = size
        guard let value = AXValueCreate(.cgSize, &mutableSize) else {
            return .failure
        }
        return AXUIElementSetAttributeValue(
            element,
            kAXSizeAttribute as CFString,
            value
        )
    }

    /// Raises the window to the front within its application.
    ///
    /// - Returns: The AXError code (.success on success).
    @discardableResult
    public static func raise(_ element: AXUIElement) -> AXError {
        AXUIElementPerformAction(element, kAXRaiseAction as CFString)
    }

    // MARK: - Private

    /// Looks up window info from CGWindowListCopyWindowInfo for a given CGWindowID.
    private static func lookupWindowInfo(windowID: UInt32) -> SystemWindowInfo? {
        guard let windowList = CGWindowListCopyWindowInfo(
            [.optionAll, .excludeDesktopElements],
            kCGNullWindowID
        ) as? [[String: Any]] else {
            return nil
        }

        for dict in windowList {
            guard let id = dict[kCGWindowNumber as String] as? UInt32, id == windowID else {
                continue
            }
            // Reuse the shared parser so the display and all fields match the manager's
            // (this path previously hardcoded the main display).
            return SystemWindowManager.windowInfo(from: dict)
        }

        return nil
    }

    /// Finds the best matching AXUIElement from an array of AX windows by comparing
    /// title, position, and size against the CG-reported values.
    ///
    /// Title is weighted highest (+10) so a title match dominates a mere geometry match
    /// (+5/+3); a candidate with no signal at all (score 0) is never selected. Two
    /// windows of one app that share BOTH title and frame are inherently ambiguous via
    /// the public Accessibility API (AXUIElement exposes no CGWindowID), so the first
    /// such window wins — acceptable since identical title+frame means they overlap.
    private static func bestMatch(
        axWindows: [AXUIElement],
        title: String,
        frame: CGRect
    ) -> AXUIElement? {
        var bestElement: AXUIElement?
        var bestScore = 0

        for axWindow in axWindows {
            var score = 0

            // Title match (strong signal when title is non-empty)
            if let axTitle = self.title(of: axWindow) {
                if !title.isEmpty && axTitle == title {
                    score += 10
                } else if title.isEmpty && axTitle.isEmpty {
                    // Both empty — weak signal, but still a match candidate
                    score += 1
                }
            }

            // Position match (within tolerance for rounding differences)
            if let axPosition = self.position(of: axWindow) {
                if abs(axPosition.x - frame.origin.x) < 2 &&
                   abs(axPosition.y - frame.origin.y) < 2 {
                    score += 5
                }
            }

            // Size match (within tolerance)
            if let axSize = self.size(of: axWindow) {
                if abs(axSize.width - frame.size.width) < 2 &&
                   abs(axSize.height - frame.size.height) < 2 {
                    score += 3
                }
            }

            if score > bestScore {
                bestScore = score
                bestElement = axWindow
            }
        }

        return bestElement
    }
}

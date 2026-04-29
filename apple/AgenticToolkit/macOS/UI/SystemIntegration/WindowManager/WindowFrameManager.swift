import AppKit
import os
import AgenticToolkitCore

/// Centralized window frame persistence using proportional positioning.
///
/// Instead of absolute pixel coordinates, positions are stored as
/// proportions of the screen's visible frame. A window at "80% from
/// left, 85% from bottom" stays in the upper-right area regardless of
/// screen resolution or size changes.
///
/// Usage:
///   1. Register window specs at app startup via `register(id:spec:)`.
///   2. After creating a window, call `restoreFrame(for:id:)`.
///   3. Before hiding/closing, call `saveFrame(for:id:)`.
///
/// Owned by `WindowManager`; accessed via `WindowManager.shared.frames`.
@MainActor
public final class WindowFrameManager {

    public let screenProvider: ScreenProvider
    public let storage: WindowStateStorage

    fileprivate var windowSpecs: [String: WindowSpec] = [:]

    public init(
        screenProvider: ScreenProvider = RealScreenProvider(),
        storage: WindowStateStorage = UserDefaultsWindowStateStorage()
    ) {
        self.screenProvider = screenProvider
        self.storage = storage
        // Auto-observe screen changes so hosts don't need a separate call.
        // No-op on second invocation if a host explicitly re-calls.
        startObservingScreenChanges()
    }

    /// Starts observing screen change notifications. Called automatically by
    /// `init`; exposed publicly so hosts can re-arm after detaching.
    public func startObservingScreenChanges() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screensDidChange),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    // MARK: - Registration

    /// Registers a window spec. Call once per window identifier at app startup.
    public func register(id: String, spec: WindowSpec) {
        windowSpecs[id] = spec
    }

    // MARK: - Frame Restoration

    /// Restores a window's frame from saved proportional state, or applies
    /// defaults. Tags the window with an identifier so screen-change events
    /// can find it.
    @discardableResult
    public func restoreFrame(for window: NSWindow, id: String) -> Bool {
        window.identifier = NSUserInterfaceItemIdentifier("wm_\(id)")

        guard let spec = windowSpecs[id] else {
            logger.warning("WindowFrameManager: no spec for '\(id, privacy: .public)'")
            applyGeometricCenter(to: window)
            return false
        }

        window.minSize = spec.minSize

        guard spec.persistsFrame, let saved = storage.loadState(for: id) else {
            applyDefaultPosition(to: window, spec: spec)
            return false
        }

        let screens = screenProvider.screens
        guard !screens.isEmpty else {
            applyGeometricCenter(to: window)
            return false
        }

        // Find best matching screen, fall back to main
        let match = ScreenMatcher.findBestMatch(for: saved.screenFingerprint, among: screens)
        let targetScreen = match?.screen ?? screenProvider.mainScreen ?? screens[0]

        let frame = FrameCalculator.absoluteFrame(
            proportionalX: saved.proportionalX,
            proportionalY: saved.proportionalY,
            width: saved.width,
            height: saved.height,
            screenVisibleFrame: targetScreen.visibleFrame,
            minSize: spec.minSize
        )
        let validated = FrameCalculator.validateFrame(
            frame,
            screenVisibleFrame: targetScreen.visibleFrame,
            minSize: spec.minSize
        )

        window.setFrame(validated, display: true)
        logger.debug("WindowFrameManager: restored '\(id, privacy: .public)' quality=\(match?.quality.rawValue ?? 0)")
        return true
    }

    // MARK: - Frame Saving

    /// Saves the window's current frame as proportional coordinates.
    public func saveFrame(for window: NSWindow, id: String) {
        guard let spec = windowSpecs[id], spec.persistsFrame else { return }

        let screens = screenProvider.screens
        guard let screen = Self.bestScreen(for: window, among: screens) else { return }

        let pos = FrameCalculator.proportionalPosition(
            windowFrame: window.frame,
            screenVisibleFrame: screen.visibleFrame
        )

        let state = PersistedWindowState(
            proportionalX: pos.x,
            proportionalY: pos.y,
            width: window.frame.width,
            height: window.frame.height,
            screenFingerprint: screen.fingerprint,
            savedAt: Date()
        )

        storage.saveState(state, for: id)
    }

    // MARK: - Reset

    /// Clears saved state for a window and applies its default position.
    public func resetFrame(for window: NSWindow, id: String) {
        storage.removeState(for: id)
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
    }

    /// Clears saved state for a single window.
    public func clearSavedState(for id: String) {
        storage.removeState(for: id)
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

    @objc private func screensDidChange() {
        let screens = screenProvider.screens
        for (id, spec) in windowSpecs {
            let wmId = "wm_\(id)"
            for window in NSApp.windows {
                guard window.isVisible,
                      window.identifier?.rawValue == wmId,
                      let screen = Self.bestScreen(for: window, among: screens) else { continue }
                let validated = FrameCalculator.validateFrame(
                    window.frame,
                    screenVisibleFrame: screen.visibleFrame,
                    minSize: spec.minSize
                )
                if validated != window.frame {
                    window.setFrame(validated, display: true, animate: true)
                    logger.debug("WindowFrameManager: pushed '\(id, privacy: .public)' on-screen after display change")
                }
            }
        }
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
        if let ws = window.screen {
            return RealScreenInfo(screen: ws)
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

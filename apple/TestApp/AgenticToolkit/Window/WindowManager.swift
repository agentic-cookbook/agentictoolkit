import AppKit
import CoreGraphics

// MARK: - Window Position

/// A proportional position within a screen's visible frame.
/// Values range from 0.0 (left/bottom edge) to 1.0 (right/top edge).
enum WindowPosition {
    case center
    case topRight
    case custom(x: CGFloat, y: CGFloat)

    var proportionalX: CGFloat {
        switch self {
        case .center: return 0.5
        case .topRight: return 0.85
        case .custom(let x, _): return x
        }
    }

    var proportionalY: CGFloat {
        switch self {
        case .center: return 0.5
        case .topRight: return 0.85
        case .custom(_, let y): return y
        }
    }
}

// MARK: - Window Spec

/// Declares the spatial rules for a managed window.
struct WindowSpec {
    let defaultSize: NSSize
    let minSize: NSSize
    let defaultPosition: WindowPosition
    let persistsFrame: Bool
}

// MARK: - Screen Info Protocol

/// Abstracts screen geometry so tests can inject mock screens.
protocol ScreenInfo {
    var frame: NSRect { get }
    var visibleFrame: NSRect { get }
    var fingerprint: ScreenFingerprint { get }
}

/// Provides the current set of screens. Injected into WindowManager for testing.
protocol ScreenProvider {
    var screens: [ScreenInfo] { get }
    var mainScreen: ScreenInfo? { get }
}

// MARK: - Window State Storage

/// Abstracts persistence so tests can use in-memory storage.
protocol WindowStateStorage {
    func loadState(for id: String) -> PersistedWindowState?
    func saveState(_ state: PersistedWindowState, for id: String)
    func removeState(for id: String)
}

// MARK: - Real Implementations

/// Wraps NSScreen to conform to ScreenInfo.
struct RealScreenInfo: ScreenInfo {
    let screen: NSScreen

    var frame: NSRect { screen.frame }
    var visibleFrame: NSRect { screen.visibleFrame }

    var fingerprint: ScreenFingerprint {
        ScreenFingerprint.from(screen)
    }
}

/// Provides real NSScreen data.
struct RealScreenProvider: ScreenProvider {
    var screens: [ScreenInfo] {
        NSScreen.screens.map { RealScreenInfo(screen: $0) }
    }

    var mainScreen: ScreenInfo? {
        NSScreen.main.map { RealScreenInfo(screen: $0) }
    }
}

/// Stores window state in UserDefaults as JSON.
struct UserDefaultsWindowStateStorage: WindowStateStorage {
    static let keyPrefix = "AgenticToolkitWindowState_"

    func loadState(for id: String) -> PersistedWindowState? {
        guard let data = UserDefaults.standard.data(forKey: Self.keyPrefix + id) else { return nil }
        return try? JSONDecoder().decode(PersistedWindowState.self, from: data)
    }

    func saveState(_ state: PersistedWindowState, for id: String) {
        guard let data = try? JSONEncoder().encode(state) else { return }
        UserDefaults.standard.set(data, forKey: Self.keyPrefix + id)
    }

    func removeState(for id: String) {
        UserDefaults.standard.removeObject(forKey: Self.keyPrefix + id)
    }
}

// MARK: - Screen Fingerprint

/// Identifies a screen across app relaunches using layered matching.
struct ScreenFingerprint: Codable, Equatable {
    let displayUUID: String?
    let localizedName: String?
    let resolutionWidth: CGFloat
    let resolutionHeight: CGFloat
    let isMain: Bool

    /// Creates a fingerprint for a real NSScreen.
    static func from(_ screen: NSScreen) -> ScreenFingerprint {
        var uuidString: String?
        if let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? CGDirectDisplayID {
            if let uuid = CGDisplayCreateUUIDFromDisplayID(screenNumber) {
                uuidString = CFUUIDCreateString(nil, uuid.takeUnretainedValue()) as String?
            }
        }
        return ScreenFingerprint(
            displayUUID: uuidString,
            localizedName: screen.localizedName,
            resolutionWidth: screen.frame.width,
            resolutionHeight: screen.frame.height,
            isMain: screen == NSScreen.main
        )
    }
}

// MARK: - Persisted Window State

/// The saved state for a window, stored as JSON.
struct PersistedWindowState: Codable {
    let proportionalX: CGFloat
    let proportionalY: CGFloat
    let width: CGFloat
    let height: CGFloat
    let screenFingerprint: ScreenFingerprint
    let savedAt: Date
}

// MARK: - Screen Matcher

/// Finds the best matching current screen for a saved screen fingerprint.
enum ScreenMatcher {

    enum MatchQuality: Int, Comparable {
        case positionOnly = 1
        case nameOnly = 2
        case uuidResChanged = 3
        case exact = 4

        static func < (lhs: MatchQuality, rhs: MatchQuality) -> Bool {
            lhs.rawValue < rhs.rawValue
        }
    }

    struct ScreenMatch {
        let screen: ScreenInfo
        let quality: MatchQuality
    }

    /// Finds the best current screen matching the saved fingerprint.
    static func findBestMatch(
        for fingerprint: ScreenFingerprint,
        among screens: [ScreenInfo]
    ) -> ScreenMatch? {
        var candidates: [(ScreenInfo, MatchQuality)] = []

        for screen in screens {
            let current = screen.fingerprint

            // Tier 1: UUID match
            if let savedUUID = fingerprint.displayUUID,
               let currentUUID = current.displayUUID,
               savedUUID == currentUUID {
                let resMatch = abs(current.resolutionWidth - fingerprint.resolutionWidth) < 1
                    && abs(current.resolutionHeight - fingerprint.resolutionHeight) < 1
                candidates.append((screen, resMatch ? .exact : .uuidResChanged))
                continue
            }

            // Tier 2: Name match
            if let savedName = fingerprint.localizedName,
               let currentName = current.localizedName,
               savedName == currentName {
                candidates.append((screen, .nameOnly))
                continue
            }

            // Tier 3: Position match (was main, is main)
            if fingerprint.isMain && current.isMain {
                candidates.append((screen, .positionOnly))
            }
        }

        return candidates
            .max(by: { $0.1 < $1.1 })
            .map { ScreenMatch(screen: $0.0, quality: $0.1) }
    }
}

// MARK: - Frame Calculator

/// Pure functions for proportional frame math. No side effects, fully testable.
enum FrameCalculator {

    /// Computes proportional coordinates for a window frame on a screen.
    static func proportionalPosition(
        windowFrame: NSRect,
        screenVisibleFrame: NSRect
    ) -> (x: CGFloat, y: CGFloat) {
        let availableWidth = screenVisibleFrame.width - windowFrame.width
        let availableHeight = screenVisibleFrame.height - windowFrame.height

        let propX = availableWidth > 0
            ? ((windowFrame.origin.x - screenVisibleFrame.origin.x) / availableWidth).clamped(to: -0.1...1.1)
            : 0.5
        let propY = availableHeight > 0
            ? ((windowFrame.origin.y - screenVisibleFrame.origin.y) / availableHeight).clamped(to: -0.1...1.1)
            : 0.5

        return (propX, propY)
    }

    /// Computes an absolute frame from proportional coordinates and a screen.
    static func absoluteFrame(
        proportionalX: CGFloat,
        proportionalY: CGFloat,
        width: CGFloat,
        height: CGFloat,
        screenVisibleFrame: NSRect,
        minSize: NSSize
    ) -> NSRect {
        let w = Swift.min(Swift.max(width, minSize.width), screenVisibleFrame.width)
        let h = Swift.min(Swift.max(height, minSize.height), screenVisibleFrame.height)

        let availableWidth = screenVisibleFrame.width - w
        let availableHeight = screenVisibleFrame.height - h

        let x = screenVisibleFrame.origin.x + proportionalX * Swift.max(availableWidth, 0)
        let y = screenVisibleFrame.origin.y + proportionalY * Swift.max(availableHeight, 0)

        return NSRect(x: x, y: y, width: w, height: h)
    }

    /// Computes a default frame for a spec on a screen.
    static func defaultFrame(
        spec: WindowSpec,
        screenVisibleFrame: NSRect
    ) -> NSRect {
        absoluteFrame(
            proportionalX: spec.defaultPosition.proportionalX,
            proportionalY: spec.defaultPosition.proportionalY,
            width: spec.defaultSize.width,
            height: spec.defaultSize.height,
            screenVisibleFrame: screenVisibleFrame,
            minSize: spec.minSize
        )
    }

    /// Ensures a frame is fully visible within a screen's visible area.
    static func validateFrame(
        _ frame: NSRect,
        screenVisibleFrame visible: NSRect,
        minSize: NSSize
    ) -> NSRect {
        var result = frame

        // Enforce minimum size
        result.size.width = Swift.max(result.size.width, minSize.width)
        result.size.height = Swift.max(result.size.height, minSize.height)

        // Clamp size to screen
        result.size.width = Swift.min(result.size.width, visible.width)
        result.size.height = Swift.min(result.size.height, visible.height)

        // Push into visible bounds
        if result.maxX > visible.maxX {
            result.origin.x = visible.maxX - result.width
        }
        if result.origin.x < visible.origin.x {
            result.origin.x = visible.origin.x
        }
        if result.maxY > visible.maxY {
            result.origin.y = visible.maxY - result.height
        }
        if result.origin.y < visible.origin.y {
            result.origin.y = visible.origin.y
        }

        return result
    }
}

// MARK: - Window Manager

/// Centralized window frame persistence using proportional positioning.
///
/// Instead of absolute pixel coordinates, positions are stored as proportions
/// of the screen's visible frame. A window at "80% from left, 85% from bottom"
/// stays in the upper-right area regardless of screen resolution or size changes.
///
/// Usage:
///   1. Register window specs at app startup via `register(id:spec:)`
///   2. After creating a window, call `restoreFrame(for:id:)`
///   3. Before hiding/closing, call `saveFrame(for:id:)`
final class WindowManager {

    static let shared = WindowManager()

    private(set) var specs: [String: WindowSpec] = [:]
    let screenProvider: ScreenProvider
    let storage: WindowStateStorage

    /// Creates a WindowManager with injectable dependencies.
    /// - Parameters:
    ///   - screenProvider: Provides current screen geometry. Defaults to real NSScreen data.
    ///   - storage: Persists window state. Defaults to UserDefaults.
    init(screenProvider: ScreenProvider = RealScreenProvider(), storage: WindowStateStorage = UserDefaultsWindowStateStorage()) {
        self.screenProvider = screenProvider
        self.storage = storage
    }

    /// Starts observing screen change notifications. Called automatically for the shared instance.
    func startObservingScreenChanges() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(screensDidChange),
            name: NSApplication.didChangeScreenParametersNotification,
            object: nil
        )
    }

    // MARK: - Registration

    /// Registers a window spec. Call once per window identifier at app startup.
    func register(id: String, spec: WindowSpec) {
        specs[id] = spec
    }

    // MARK: - Frame Restoration

    /// Restores a window's frame from saved proportional state, or applies defaults.
    /// Tags the window with an identifier so screen-change events can find it.
    @discardableResult
    func restoreFrame(for window: NSWindow, id: String) -> Bool {
        window.identifier = NSUserInterfaceItemIdentifier("wm_\(id)")

        guard let spec = specs[id] else {
            Log.ui.warning("WindowManager: no spec for '\(id, privacy: .public)'")
            window.center()
            return false
        }

        window.minSize = spec.minSize

        guard spec.persistsFrame, let saved = storage.loadState(for: id) else {
            applyDefaultPosition(to: window, spec: spec)
            return false
        }

        let screens = screenProvider.screens
        guard !screens.isEmpty else {
            window.center()
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
        Log.ui.debug("WindowManager: restored '\(id, privacy: .public)' quality=\(match?.quality.rawValue ?? 0)")
        return true
    }

    // MARK: - Frame Saving

    /// Saves the window's current frame as proportional coordinates.
    func saveFrame(for window: NSWindow, id: String) {
        guard let spec = specs[id], spec.persistsFrame else { return }

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
    func resetFrame(for window: NSWindow, id: String) {
        storage.removeState(for: id)
        if let spec = specs[id] {
            applyDefaultPosition(to: window, spec: spec)
        } else {
            window.center()
        }
    }

    /// Clears all saved window states.
    func resetAllFrames() {
        for id in specs.keys {
            storage.removeState(for: id)
        }
    }

    /// Clears saved state for a single window.
    func clearSavedState(for id: String) {
        storage.removeState(for: id)
    }

    // MARK: - Default Position

    private func applyDefaultPosition(to window: NSWindow, spec: WindowSpec) {
        guard let screen = screenProvider.mainScreen ?? screenProvider.screens.first else {
            window.center()
            return
        }
        let frame = FrameCalculator.defaultFrame(spec: spec, screenVisibleFrame: screen.visibleFrame)
        window.setFrame(frame, display: true)
    }

    // MARK: - Screen Change Handling

    @objc private func screensDidChange() {
        let screens = screenProvider.screens
        for (id, spec) in specs {
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
                    Log.ui.debug("WindowManager: pushed '\(id, privacy: .public)' on-screen after display change")
                }
            }
        }
    }

    // MARK: - Screen Helpers

    /// Returns the screen containing the largest portion of the window.
    static func bestScreen(for window: NSWindow, among screens: [ScreenInfo]) -> ScreenInfo? {
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

// MARK: - CGFloat Clamping

extension CGFloat {
    func clamped(to range: ClosedRange<CGFloat>) -> CGFloat {
        Swift.min(Swift.max(self, range.lowerBound), range.upperBound)
    }
}
